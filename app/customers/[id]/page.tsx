'use client';

import { AdminLayout } from "@/components/AdminLayout";
import { countryService, customerService, serviceRequestService, currencyService } from "@/lib/api/services";
import { formatTypeLabel, formatStatusLabel } from "@/lib/serviceRequestLabels";
import { formatAmount, formatDate } from "@/lib/format";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Country, CustomerProfile, ServiceRequest, ApiResponse, SubscriptionUsage, AddSubscriptionUsagePayload, Currency, UpdateCustomerProfilePayload } from "@/lib/api/types";

const USAGE_ADD_SERVICE_TYPES = [
  { value: 'AD_HOC', label: 'Ad Hoc' },
  { value: 'IP_REGISTRATION', label: 'IP Registration' },
  { value: 'TRADEMARK_REGISTRATION', label: 'Trademark Registration' },
  { value: 'CONTRACT_REQUEST', label: 'Contract Request' },
  { value: 'CONTRACT_REVIEW', label: 'Contract Review' },
  { value: 'COMPANY_INCORPORATION', label: 'Company Incorporation' },
  { value: 'SOLE_PROPRIETORSHIP_INCORPORATION', label: 'Sole Proprietorship Incorporation' },
  { value: 'LEGAL_CONSULTATION', label: 'Legal Consultation' },
] as const;

const USAGE_ADD_STATUSES = [
  'DRAFT', 'RECEIVED', 'ACKNOWLEDGED', 'PENDING_ASSESSMENT', 'PENDING_PAYMENT',
  'IN_PROGRESS', 'UNDER_REVIEW', 'TRANSFERRED', 'COMPLETED',
] as const;

function formatCustomerEntityLabel(row: Record<string, unknown>): string {
  if (typeof row.name === 'string' && row.name.trim()) return row.name.trim();
  const parts = [row.firstName, row.otherNames, row.lastName].filter(
    (x): x is string => typeof x === 'string' && x.trim() !== ''
  );
  if (parts.length) return parts.join(' ');
  if (typeof row.emailAddress === 'string' && row.emailAddress.trim()) return row.emailAddress.trim();
  if (typeof row.type === 'string' && row.type.trim()) {
    const id = row.id ?? row._id;
    return `${row.type.trim()} (${String(id ?? '')})`.replace(/\s+\(\)$/, '');
  }
  return String(row.id ?? row._id ?? 'Entity');
}

function normalizeEntityListRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: Record<string, unknown>[] }).data;
  }
  if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: Record<string, unknown>[] }).items;
  }
  return [];
}

function entityRowIsDefault(row: Record<string, unknown>): boolean {
  if (row.isDefault === true) return true;
  if (row.is_default === true) return true;
  return false;
}

/** Prefer row with isDefault; otherwise first row with a valid id. */
function pickDefaultEntityIdFromRows(rows: Record<string, unknown>[]): string {
  const withIds = rows.filter((row) => String(row.id ?? row._id ?? '').trim());
  if (withIds.length === 0) return '';
  const def = withIds.find(entityRowIsDefault);
  const chosen = def ?? withIds[0];
  return String(chosen.id ?? chosen._id ?? '').trim();
}

/** Reads default currency id or code from an expanded Country object. */
function extractDefaultCurrencyHintFromCountry(c: Country): string {
  const raw = c.defaultCurrency ?? c.default_currency;
  if (raw == null) return '';
  if (typeof raw === 'string') return raw.trim();
  if (typeof raw === 'object') {
    const id = (raw as { id?: unknown }).id;
    if (typeof id === 'string' && id.trim()) return id.trim();
    if (typeof id === 'number' && Number.isFinite(id)) return String(id);
    const code = (raw as { code?: unknown }).code;
    if (typeof code === 'string' && code.trim()) return code.trim();
  }
  return '';
}

/** Match API hint (currency id or ISO code) to a row in the portal currency list. */
function pickCurrencyIdFromList(hint: string, currencyList: Currency[]): string {
  const w = hint.trim();
  if (!w || currencyList.length === 0) return '';
  const byId = currencyList.find((cur) => cur.id === w);
  if (byId) return byId.id;
  const byCode = currencyList.find((cur) => cur.code.toUpperCase() === w.toUpperCase());
  if (byCode) return byCode.id;
  return '';
}

/**
 * Resolves the customer's default currency id for the usage form.
 * Profile often has `country` as a string id only — then we fetch `/api/v1/countries/{id}`.
 */
async function resolveDefaultCurrencyForCustomer(
  country: CustomerProfile['country'] | undefined,
  currencyList: Currency[]
): Promise<string> {
  let c: Country | null = null;
  if (!country) return '';
  if (typeof country === 'object' && country !== null) {
    c = country as Country;
  } else if (typeof country === 'string' && country.trim()) {
    try {
      const res = await countryService.getById(country.trim());
      c = res.data;
    } catch {
      return '';
    }
  }
  if (!c) return '';
  const hint = extractDefaultCurrencyHintFromCountry(c);
  return pickCurrencyIdFromList(hint, currencyList);
}

type UsageContextKvRow = { id: string; key: string; value: string };

function newUsageContextKvRow(): UsageContextKvRow {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return { id, key: '', value: '' };
}

/** First row seeds key `notes` (user may delete or rename). */
function defaultUsageContextRows(): UsageContextKvRow[] {
  const r = newUsageContextKvRow();
  r.key = 'notes';
  return [r];
}

function rowUsesNotesValueEditor(row: UsageContextKvRow): boolean {
  return row.key.trim().toLowerCase() === 'notes';
}

function coerceContextValueFromString(raw: string): unknown {
  const t = raw.trim();
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  if (/^-?\d+$/.test(t)) return parseInt(t, 10);
  if (/^-?\d+\.\d+$/.test(t) || /^-?\d+\.$/.test(t)) return parseFloat(t);
  if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
    try {
      return JSON.parse(t) as unknown;
    } catch {
      return raw;
    }
  }
  return raw;
}

function buildContextFromKvRows(rows: UsageContextKvRow[]): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    const k = row.key.trim();
    if (!k) continue;
    if (row.value.trim() === '') continue;
    out[k] = k.toLowerCase() === 'notes' ? row.value : coerceContextValueFromString(row.value);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function contextObjectToKvRows(obj: Record<string, unknown>): UsageContextKvRow[] {
  return Object.entries(obj).map(([key, val]) => ({
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    key,
    value: typeof val === 'string' ? val : JSON.stringify(val),
  }));
}

function countryIdFromProfile(country: CustomerProfile['country'] | undefined): string {
  if (!country) return '';
  if (typeof country === 'string') return country.trim();
  return (country.id || '').trim();
}

/** Normalize profile/API DOB to `YYYY-MM-DD` for `<input type="date">`. */
function profileDobToHtmlDate(profile: CustomerProfile): string {
  const raw =
    profile.dateOfBirth ??
    (typeof profile.date_of_birth === 'string' ? profile.date_of_birth : undefined);
  if (raw == null || raw === '') return '';
  const s = typeof raw === 'string' ? raw.trim() : String(raw);
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const ddmm = formatDate(s, { format: 'dd/mm/yyyy' });
  if (ddmm === 'N/A') return '';
  const [dd, mm, yyyy] = ddmm.split('/');
  if (!yyyy || !mm || !dd) return '';
  return `${yyyy}-${mm}-${dd}`;
}

function formatProfileDobDisplay(profile: CustomerProfile): string {
  const raw =
    profile.dateOfBirth ??
    (typeof profile.date_of_birth === 'string' ? profile.date_of_birth : undefined);
  if (raw == null || raw === '') return 'N/A';
  const formatted = formatDate(raw, { format: 'dd/mm/yyyy' });
  return formatted === 'N/A' ? String(raw).trim() || 'N/A' : formatted;
}

type ProfileEditFormState = {
  firstName: string;
  otherNames: string;
  lastName: string;
  country: string;
  dateOfBirth: string;
  address: string;
};

function profileToEditForm(profile: CustomerProfile): ProfileEditFormState {
  return {
    firstName: profile.firstName ?? '',
    otherNames: profile.otherNames ?? '',
    lastName: profile.lastName ?? '',
    country: countryIdFromProfile(profile.country),
    dateOfBirth: profileDobToHtmlDate(profile),
    address: profile.address ?? '',
  };
}

function buildCustomerProfilePatch(
  original: CustomerProfile,
  form: ProfileEditFormState
): UpdateCustomerProfilePayload | null {
  const payload: UpdateCustomerProfilePayload = {};
  const t = (s: string) => s.trim();

  if (t(form.firstName) !== t(original.firstName ?? '')) {
    payload.firstName = t(form.firstName);
  }
  if (t(form.otherNames) !== t(original.otherNames ?? '')) {
    payload.otherNames = t(form.otherNames);
  }
  if (t(form.lastName) !== t(original.lastName ?? '')) {
    payload.lastName = t(form.lastName);
  }
  if (t(form.country) !== t(countryIdFromProfile(original.country))) {
    payload.country = t(form.country);
  }
  const origDob = profileDobToHtmlDate(original);
  const nextDob = t(form.dateOfBirth);
  if (nextDob !== origDob) {
    payload.dateOfBirth = nextDob === '' ? null : nextDob;
  }
  if (t(form.address) !== t(original.address ?? '')) {
    payload.address = t(form.address);
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;
  
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [selectedServiceRequest, setSelectedServiceRequest] = useState<ServiceRequest | null>(null);
  const [showServiceRequestModal, setShowServiceRequestModal] = useState(false);
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    paid: '', // 'paid', 'unpaid', or ''
  });
  const [subscriptionUsage, setSubscriptionUsage] = useState<SubscriptionUsage | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [showUpdateUsageModal, setShowUpdateUsageModal] = useState(false);
  const [selectedServiceRequestForUsage, setSelectedServiceRequestForUsage] = useState<ServiceRequest | null>(null);
  const [updatingUsage, setUpdatingUsage] = useState(false);
  const [showAddUsageModal, setShowAddUsageModal] = useState(false);
  const [addUsageSubmitting, setAddUsageSubmitting] = useState(false);
  const [usageCurrencies, setUsageCurrencies] = useState<Currency[]>([]);
  const [usageEntityOptions, setUsageEntityOptions] = useState<{ id: string; label: string }[]>([]);
  const [loadingUsageEntities, setLoadingUsageEntities] = useState(false);
  const [addUsageForm, setAddUsageForm] = useState({
    type: '',
    status: 'COMPLETED',
    entity_id: '',
    price: '',
    currency: '',
    contextMode: 'kv' as 'kv' | 'json',
    contextKvRows: defaultUsageContextRows(),
    contextJson: '',
  });

  const [countriesList, setCountriesList] = useState<Country[]>([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileEditForm, setProfileEditForm] = useState<ProfileEditFormState | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const dobInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await countryService.list({ limit: 500 });
        if (!cancelled) setCountriesList(Array.isArray(res.data) ? res.data : []);
      } catch {
        if (!cancelled) setCountriesList([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showAddUsageModal) return;
    let cancelled = false;
    setUsageEntityOptions([]);
    (async () => {
      let currencyList: Currency[] = [];
      try {
        const res: ApiResponse<Currency[]> = await currencyService.list({ limit: 100 });
        if (!cancelled) {
          currencyList = Array.isArray(res.data) ? res.data : [];
          setUsageCurrencies(currencyList);
        }
      } catch {
        if (!cancelled) setUsageCurrencies([]);
      }

      let rows: Record<string, unknown>[] = [];
      setLoadingUsageEntities(true);
      try {
        const listRes = await customerService.listCustomerEntities(customerId);
        if (!cancelled) {
          rows = normalizeEntityListRows(listRes.data);
        }
      } catch {
        /* list failed */
      } finally {
        if (!cancelled) setLoadingUsageEntities(false);
      }

      if (cancelled) return;

      const options = rows
        .map((row) => ({
          id: String(row.id ?? row._id ?? '').trim(),
          label: formatCustomerEntityLabel(row),
        }))
        .filter((o) => o.id);
      setUsageEntityOptions(options);

      const defaultEntityId = options.length > 0 ? pickDefaultEntityIdFromRows(rows) : '';
      const defaultCurrencyId = profile
        ? await resolveDefaultCurrencyForCustomer(profile.country, currencyList)
        : '';

      setAddUsageForm((prev) => ({
        ...prev,
        entity_id: defaultEntityId,
        currency: prev.currency === '' && defaultCurrencyId ? defaultCurrencyId : prev.currency,
      }));
    })();
    return () => {
      cancelled = true;
    };
  }, [showAddUsageModal, customerId, profile]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const response: ApiResponse<CustomerProfile> = await customerService.getProfile(customerId);
        setProfile(response.data);
        // Load subscription usage if customer has a subscription
        if (response.data.subscription) {
          loadSubscriptionUsage();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load customer profile');
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [customerId]);

  const loadSubscriptionUsage = async () => {
    try {
      setLoadingUsage(true);
      const response: ApiResponse<SubscriptionUsage> = await customerService.getSubscriptionUsage(customerId);
      setSubscriptionUsage(response.data);
    } catch (err) {
      console.error('Failed to load subscription usage:', err);
      // Don't show error if customer doesn't have usage (might not have subscription)
    } finally {
      setLoadingUsage(false);
    }
  };

  const handleUpdateUsage = async () => {
    if (!selectedServiceRequestForUsage) return;
    
    try {
      setUpdatingUsage(true);
      setError(null);
      await customerService.updateSubscriptionUsage(customerId, {
        service_request_id: selectedServiceRequestForUsage.id,
      });
      setShowUpdateUsageModal(false);
      setSelectedServiceRequestForUsage(null);
      // Reload usage to show updated values
      await loadSubscriptionUsage();
      // Show success message
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update subscription usage');
    } finally {
      setUpdatingUsage(false);
    }
  };

  const handleAddSubscriptionUsage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUsageForm.type.trim()) {
      setError('Select a service request type.');
      return;
    }
    const priceTrim = addUsageForm.price.trim();
    const price = priceTrim === '' ? NaN : parseFloat(priceTrim);
    const hasPricing = priceTrim !== '' && Number.isFinite(price);
    if (hasPricing && !addUsageForm.currency.trim()) {
      setError('Select a currency when a price is set.');
      return;
    }
    let context: Record<string, unknown> | undefined;
    if (addUsageForm.contextMode === 'json') {
      if (addUsageForm.contextJson.trim()) {
        try {
          const parsed = JSON.parse(addUsageForm.contextJson) as unknown;
          if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            setError('Context must be a JSON object.');
            return;
          }
          context = parsed as Record<string, unknown>;
        } catch {
          setError('Context must be valid JSON.');
          return;
        }
      }
    } else {
      context = buildContextFromKvRows(addUsageForm.contextKvRows);
    }
    const payload: AddSubscriptionUsagePayload = {
      type: addUsageForm.type.trim(),
      status: addUsageForm.status || 'COMPLETED',
    };
    if (addUsageForm.entity_id.trim()) payload.entity_id = addUsageForm.entity_id.trim();
    if (hasPricing) {
      payload.pricingInfo = { price, currency: addUsageForm.currency.trim() };
    }
    if (context) payload.context = context;
    try {
      setAddUsageSubmitting(true);
      setError(null);
      await customerService.addSubscriptionUsage(customerId, payload);
      setShowAddUsageModal(false);
      setAddUsageForm({
        type: '',
        status: 'COMPLETED',
        entity_id: '',
        price: '',
        currency: '',
        contextMode: 'kv',
        contextKvRows: defaultUsageContextRows(),
        contextJson: '',
      });
      await loadSubscriptionUsage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add subscription usage');
    } finally {
      setAddUsageSubmitting(false);
    }
  };

  useEffect(() => {
    const loadServiceRequests = async () => {
      try {
        setLoadingRequests(true);
        setCursor(null); // Reset cursor when filters change
        const response: ApiResponse<ServiceRequest[]> = await serviceRequestService.list({ 
          limit: 50,
          customerId: customerId,
          type: filters.type || undefined,
          status: filters.status || undefined,
        });
        
        let requests = response.data;
        
        // Filter by customer (if API doesn't support customerId filter, filter client-side)
        requests = requests.filter(req => {
          return req.entity?.owner?.id === customerId;
        });
        
        // Filter by paid status if specified
        if (filters.paid === 'paid') {
          requests = requests.filter(req => req.invoice && req.invoice.id);
        } else if (filters.paid === 'unpaid') {
          requests = requests.filter(req => !req.invoice || !req.invoice.id);
        }
        
        // Sort: paid first, then by most recent (created/modified date), then by status
        requests.sort((a, b) => {
          // First: paid vs unpaid
          const aPaid = a.invoice && a.invoice.id ? 1 : 0;
          const bPaid = b.invoice && b.invoice.id ? 1 : 0;
          if (aPaid !== bPaid) {
            return bPaid - aPaid; // Paid first
          }
          
          // Second: most recent first (use created/modified from root, context, or invoice)
          const aDate = a.created || a.context?.modified || a.context?.created || a.invoice?.created || '';
          const bDate = b.created || b.context?.modified || b.context?.created || b.invoice?.created || '';
          if (aDate && bDate) {
            const dateCompare = new Date(bDate).getTime() - new Date(aDate).getTime();
            if (dateCompare !== 0) {
              return dateCompare;
            }
          }
          
          // Third: by status (alphabetical)
          return a.status.localeCompare(b.status);
        });
        
        setServiceRequests(requests);
        setCursor(response.pagination?.nextCursor || null);
        setHasNext(response.pagination?.hasNext || false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load service requests');
      } finally {
        setLoadingRequests(false);
      }
    };
    
    loadServiceRequests();
  }, [customerId, filters.type, filters.status, filters.paid]);

  const loadMoreServiceRequests = async () => {
    if (!cursor || loadingRequests) return;
    try {
      setLoadingRequests(true);
      const response: ApiResponse<ServiceRequest[]> = await serviceRequestService.list({ 
        cursor: cursor,
        limit: 50,
        customerId: customerId,
        type: filters.type || undefined,
        status: filters.status || undefined,
      });
      
      let requests = response.data.filter(req => req.entity?.owner?.id === customerId);
      
      if (filters.paid === 'paid') {
        requests = requests.filter(req => req.invoice && req.invoice.id);
      } else if (filters.paid === 'unpaid') {
        requests = requests.filter(req => !req.invoice || !req.invoice.id);
      }
      
      setServiceRequests(prev => [...prev, ...requests]);
      setCursor(response.pagination?.nextCursor || null);
      setHasNext(response.pagination?.hasNext || false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more service requests');
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleFilterChange = (key: 'type' | 'status' | 'paid', value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCursor(null);
  };

  const clearFilters = () => {
    setFilters({ type: '', status: '', paid: '' });
    setCursor(null);
  };

  const openDobPicker = () => {
    const el = dobInputRef.current;
    if (!el) return;
    try {
      el.showPicker?.();
    } catch {
      el.focus();
    }
  };

  const handleStartEditProfile = () => {
    if (!profile) return;
    setProfileEditForm(profileToEditForm(profile));
    setEditingProfile(true);
    setError(null);
  };

  const handleCancelEditProfile = () => {
    setEditingProfile(false);
    setProfileEditForm(null);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !profileEditForm) return;
    const patch = buildCustomerProfilePatch(profile, profileEditForm);
    if (!patch) {
      handleCancelEditProfile();
      return;
    }
    try {
      setSavingProfile(true);
      setError(null);
      await customerService.updateProfile(customerId, patch);
      const refreshed = await customerService.getProfile(customerId);
      setProfile(refreshed.data);
      handleCancelEditProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const formatCustomerName = (customer?: CustomerProfile): string => {
    if (!customer) return 'N/A';
    const parts = [customer.firstName, customer.otherNames, customer.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : customer.emailAddress || 'N/A';
  };

  const formatPrice = (pricingInfo?: ServiceRequest['pricingInfo']): string => {
    if (!pricingInfo) return 'N/A';
    const currency = pricingInfo.currency 
      ? (typeof pricingInfo.currency === 'object' 
          ? pricingInfo.currency.code 
          : pricingInfo.currency)
      : 'N/A';
    const price = pricingInfo.price != null ? formatAmount(pricingInfo.price) : 'N/A';
    return `${currency} ${price}`;
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-center text-gray-600 dark:text-gray-400">Loading customer profile...</div>
      </AdminLayout>
    );
  }

  if (error && !profile) {
    return (
      <AdminLayout>
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => router.back()}
              className="mb-4 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              ← Back to Customers
            </button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Customer Profile
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {formatCustomerName(profile || undefined)}
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        )}

        {/* Customer Profile Overview */}
        {profile && (
          <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Profile Overview</h2>
              {!editingProfile ? (
                <button
                  type="button"
                  onClick={handleStartEditProfile}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  Edit profile
                </button>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCancelEditProfile}
                    disabled={savingProfile}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="customer-profile-edit-form"
                    disabled={savingProfile || !profileEditForm}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                  >
                    {savingProfile ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              )}
            </div>
            <div className="px-6 py-4">
              {editingProfile && profileEditForm ? (
                <form id="customer-profile-edit-form" onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor="profile-first-name"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        First name
                      </label>
                      <input
                        id="profile-first-name"
                        type="text"
                        value={profileEditForm.firstName}
                        onChange={(e) =>
                          setProfileEditForm((prev) =>
                            prev ? { ...prev, firstName: e.target.value } : prev
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="profile-other-names"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Other names
                      </label>
                      <input
                        id="profile-other-names"
                        type="text"
                        value={profileEditForm.otherNames}
                        onChange={(e) =>
                          setProfileEditForm((prev) =>
                            prev ? { ...prev, otherNames: e.target.value } : prev
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="profile-last-name"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Last name
                      </label>
                      <input
                        id="profile-last-name"
                        type="text"
                        value={profileEditForm.lastName}
                        onChange={(e) =>
                          setProfileEditForm((prev) =>
                            prev ? { ...prev, lastName: e.target.value } : prev
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="profile-country"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Country
                      </label>
                      <select
                        id="profile-country"
                        value={profileEditForm.country}
                        onChange={(e) =>
                          setProfileEditForm((prev) =>
                            prev ? { ...prev, country: e.target.value } : prev
                          )
                        }
                        className="mt-1 w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                      >
                        <option value="">Select country</option>
                        {countriesList.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.code})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <span
                        id="profile-dob-label"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Date of birth
                      </span>
                      <div
                        className="mt-1 cursor-pointer rounded-lg border border-gray-300 bg-white shadow-sm transition hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500"
                        onClick={openDobPicker}
                      >
                        <input
                          ref={dobInputRef}
                          type="date"
                          lang="en-GB"
                          aria-labelledby="profile-dob-label"
                          value={profileEditForm.dateOfBirth}
                          onChange={(e) =>
                            setProfileEditForm((prev) =>
                              prev ? { ...prev, dateOfBirth: e.target.value } : prev
                            )
                          }
                          className="min-h-[42px] w-full cursor-pointer rounded-lg border-0 bg-transparent px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 dark:text-white dark:focus:ring-blue-400"
                        />
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label
                        htmlFor="profile-address"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Address
                      </label>
                      <textarea
                        id="profile-address"
                        value={profileEditForm.address}
                        onChange={(e) =>
                          setProfileEditForm((prev) =>
                            prev ? { ...prev, address: e.target.value } : prev
                          )
                        }
                        rows={3}
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                    <p className="font-medium text-gray-800 dark:text-gray-200">Read-only</p>
                    <p className="mt-1">
                      Email: {profile.emailAddress || 'N/A'} · Type: {profile.type} · Status:{' '}
                      {profile.status}
                    </p>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {formatCustomerName(profile)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {profile.emailAddress || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Type</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">{profile.type}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">{profile.status}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Country</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {profile.residentCountryName ||
                        (typeof profile.country === 'object'
                          ? profile.country?.name || profile.country?.code
                          : profile.country) ||
                        'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Date of birth
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {formatProfileDobDisplay(profile)}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Address</label>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-900 dark:text-white">
                      {profile.address?.trim() ? profile.address : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Subscription
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {profile.subscription ? (
                        <Link
                          href={`/subscription-plans?planId=${profile.subscription.plan?.id || profile.subscription.planId}`}
                          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <span className="inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                          <span>
                            {profile.subscription.plan?.label ||
                              profile.subscription.plan?.code ||
                              `Plan ${profile.subscription.planId}` ||
                              'Active Subscription'}
                          </span>
                        </Link>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                          None
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Subscription Usage Section */}
        {profile?.subscription && (
          <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Subscription Usage</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setAddUsageForm({
                        type: '',
                        status: 'COMPLETED',
                        entity_id: '',
                        price: '',
                        currency: '',
                        contextMode: 'kv',
                        contextKvRows: defaultUsageContextRows(),
                        contextJson: '',
                      });
                      setUsageEntityOptions([]);
                      setShowAddUsageModal(true);
                    }}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    Add usage
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUpdateUsageModal(true);
                      setSelectedServiceRequestForUsage(null);
                    }}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                  >
                    Update Usage
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6">
              {loadingUsage ? (
                <div className="text-center text-gray-600 dark:text-gray-400 py-4">Loading usage...</div>
              ) : subscriptionUsage && Object.keys(subscriptionUsage).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(subscriptionUsage).map(([serviceType, usage]) => (
                    <div key={serviceType} className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {serviceType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </h3>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                          usage.remaining > 0
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                        }`}>
                          {usage.remaining > 0 ? `${usage.remaining} remaining` : 'Exhausted'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Limit</label>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{usage.limit}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Used</label>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{usage.used}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Remaining</label>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{usage.remaining}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Discount</label>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{usage.discount_percent}%</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                          <span>Usage Progress</span>
                          <span>{Math.round((usage.used / usage.limit) * 100)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                          <div
                            className={`h-2 rounded-full ${
                              usage.remaining > 0 ? 'bg-blue-600' : 'bg-red-600'
                            }`}
                            style={{ width: `${Math.min((usage.used / usage.limit) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Period: {usage.period}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-600 dark:text-gray-400 py-4">
                  No usage data available
                </div>
              )}
            </div>
          </div>
        )}

        {/* Service Requests Section */}
        <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Service Requests</h2>
          </div>

          {/* Filters */}
          <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[150px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Filter by Type
                </label>
                <select
                  value={filters.type}
                  onChange={(e) => handleFilterChange('type', e.target.value)}
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                >
                  <option value="">All Types</option>
                  <option value="AD_HOC">AD_HOC</option>
                  <option value="IP_REGISTRATION">IP_REGISTRATION</option>
                  <option value="TRADEMARK_REGISTRATION">TRADEMARK_REGISTRATION</option>
                  <option value="CONTRACT_REQUEST">CONTRACT_REQUEST</option>
                  <option value="CONTRACT_REVIEW">CONTRACT_REVIEW</option>
                  <option value="COMPANY_INCORPORATION">COMPANY_INCORPORATION</option>
                  <option value="SOLE_PROPRIETORSHIP_INCORPORATION">SOLE_PROPRIETORSHIP_INCORPORATION</option>
                </select>
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Filter by Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                >
                  <option value="">All Statuses</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="RECEIVED">RECEIVED</option>
                  <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                  <option value="COMPLETED">COMPLETED</option>
                </select>
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Payment Status
                </label>
                <select
                  value={filters.paid}
                  onChange={(e) => handleFilterChange('paid', e.target.value)}
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                >
                  <option value="">All</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </div>
              {(filters.type || filters.status || filters.paid) && (
                <div className="flex items-end">
                  <button
                    onClick={clearFilters}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Service Requests Table */}
          {loadingRequests ? (
            <div className="px-6 py-8 text-center text-gray-600 dark:text-gray-400">Loading service requests...</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Label/Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Invoice
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                    {serviceRequests.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                          No service requests found
                        </td>
                      </tr>
                    ) : (
                      serviceRequests.map((request) => (
                        <tr 
                          key={request.id} 
                          className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                          onClick={() => {
                            setSelectedServiceRequest(request);
                            setShowServiceRequestModal(true);
                          }}
                        >
                          <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-gray-900 dark:text-white">
                            {request.id.slice(0, 8)}...
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                              {formatTypeLabel(request.type)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-200">
                              {formatStatusLabel(request.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                            <div>
                              <div className="font-medium">{request.context?.label || 'N/A'}</div>
                              {request.context?.description && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {request.context.description}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-white">
                            {formatPrice(request.pricingInfo)}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {request.invoice?.number ? (
                              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-200">
                                {request.invoice.number}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                Unpaid
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {formatDate(request.created ?? request.modified)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {hasNext && serviceRequests.length > 0 && (
                <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-700">
                  <button
                    onClick={loadMoreServiceRequests}
                    disabled={loadingRequests || !hasNext}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    {loadingRequests ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Service Request Details Modal */}
        {showServiceRequestModal && selectedServiceRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowServiceRequestModal(false)}>
            <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 m-4" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-900 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Service Request Details</h2>
                <button
                  onClick={() => setShowServiceRequestModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-6">
                {/* Basic Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Basic Information</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">ID</label>
                      <p className="mt-1 text-sm font-mono text-gray-900 dark:text-white">{selectedServiceRequest.id}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Type</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                          {selectedServiceRequest.type}
                        </span>
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-200">
                          {selectedServiceRequest.status}
                        </span>
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Price</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">{formatPrice(selectedServiceRequest.pricingInfo)}</p>
                    </div>
                  </div>
                </div>

                {/* Context Information */}
                {selectedServiceRequest.context && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Context</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {selectedServiceRequest.context.label && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Label</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedServiceRequest.context.label}</p>
                        </div>
                      )}
                      {selectedServiceRequest.context.description && (
                        <div className="md:col-span-2">
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedServiceRequest.context.description}</p>
                        </div>
                      )}
                      {(selectedServiceRequest.context?.created ?? selectedServiceRequest.created) && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(selectedServiceRequest.context?.created ?? selectedServiceRequest.created)}</p>
                        </div>
                      )}
                      {(selectedServiceRequest.context?.modified ?? selectedServiceRequest.modified) && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Modified</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(selectedServiceRequest.context?.modified ?? selectedServiceRequest.modified)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Entity Information */}
                {selectedServiceRequest.entity && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Entity Information</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {selectedServiceRequest.entity.name && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedServiceRequest.entity.name}</p>
                        </div>
                      )}
                      {selectedServiceRequest.entity.emailAddress && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedServiceRequest.entity.emailAddress}</p>
                        </div>
                      )}
                      {selectedServiceRequest.entity.type && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Type</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedServiceRequest.entity.type}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Invoice Information */}
                {selectedServiceRequest.invoice && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Invoice</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {selectedServiceRequest.invoice.number && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Invoice Number</label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedServiceRequest.invoice.number}</p>
                        </div>
                      )}
                      {selectedServiceRequest.invoice.pricing && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Total</label>
                          <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                            {selectedServiceRequest.invoice.pricing.currency 
                              ? (typeof selectedServiceRequest.invoice.pricing.currency === 'object' 
                                  ? selectedServiceRequest.invoice.pricing.currency.code 
                                  : selectedServiceRequest.invoice.pricing.currency)
                              : 'N/A'} {selectedServiceRequest.invoice.pricing.total != null ? formatAmount(selectedServiceRequest.invoice.pricing.total) : 'N/A'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Add Subscription Usage Modal */}
        {showAddUsageModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8 backdrop-blur-[2px]"
            onClick={() => !addUsageSubmitting && setShowAddUsageModal(false)}
          >
            <div
              className="relative m-auto w-full max-w-xl max-h-[min(90vh,760px)] overflow-y-auto rounded-2xl border border-gray-200/80 bg-white shadow-2xl ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-900 dark:ring-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-100 bg-white/90 px-6 py-5 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/90">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
                    Add subscription usage
                  </h2>
                  <p className="mt-1 max-w-md text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                    Record usage against this customer&apos;s subscription. Fields below pricing are optional.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={addUsageSubmitting}
                  onClick={() => setShowAddUsageModal(false)}
                  className="shrink-0 rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleAddSubscriptionUsage} className="space-y-5 p-6 sm:p-8">
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50/90 p-4 text-sm text-red-800 shadow-sm dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                    {error}
                  </div>
                )}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Type *</label>
                  <select
                    required
                    value={addUsageForm.type}
                    onChange={(e) => setAddUsageForm((f) => ({ ...f, type: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800/80 dark:text-white"
                  >
                    <option value="">Select type</option>
                    {USAGE_ADD_SERVICE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                  <select
                    value={addUsageForm.status}
                    onChange={(e) => setAddUsageForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800/80 dark:text-white"
                  >
                    {USAGE_ADD_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                    Defaults to COMPLETED if unchanged.
                  </p>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Entity</label>
                  <select
                    value={addUsageForm.entity_id}
                    onChange={(e) => setAddUsageForm((f) => ({ ...f, entity_id: e.target.value }))}
                    disabled={loadingUsageEntities}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800/80 dark:text-white"
                  >
                    <option value="">
                      {loadingUsageEntities ? 'Loading entities…' : 'None (optional)'}
                    </option>
                    {usageEntityOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Currency</label>
                    <select
                      value={addUsageForm.currency}
                      onChange={(e) => setAddUsageForm((f) => ({ ...f, currency: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800/80 dark:text-white"
                    >
                      <option value="">Select currency (if price set)</option>
                      {usageCurrencies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Price</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={addUsageForm.price}
                      onChange={(e) => setAddUsageForm((f) => ({ ...f, price: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800/80 dark:text-white dark:placeholder:text-gray-500"
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gradient-to-b from-gray-50/90 to-white p-5 shadow-sm dark:border-gray-700 dark:from-gray-800/40 dark:to-gray-900/40 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Additional context</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                        Optional metadata. The <span className="font-medium text-gray-600 dark:text-gray-300">notes</span> field is
                        multiline; other keys use a single line.
                      </p>
                    </div>
                    <div className="flex shrink-0 rounded-xl bg-gray-200/80 p-1 dark:bg-gray-950/80">
                      <button
                        type="button"
                        onClick={() =>
                          setAddUsageForm((f) => {
                            if (f.contextMode === 'kv') return f;
                            const t = f.contextJson.trim();
                            if (!t) {
                              return { ...f, contextMode: 'kv', contextKvRows: defaultUsageContextRows() };
                            }
                            try {
                              const parsed = JSON.parse(t) as unknown;
                              if (
                                parsed !== null &&
                                typeof parsed === 'object' &&
                                !Array.isArray(parsed)
                              ) {
                                const rows = contextObjectToKvRows(parsed as Record<string, unknown>);
                                return {
                                  ...f,
                                  contextMode: 'kv',
                                  contextKvRows: rows.length ? rows : defaultUsageContextRows(),
                                };
                              }
                            } catch {
                              /* invalid JSON */
                            }
                            return { ...f, contextMode: 'kv', contextKvRows: defaultUsageContextRows() };
                          })
                        }
                        className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                          addUsageForm.contextMode === 'kv'
                            ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5 dark:bg-gray-700 dark:text-white dark:ring-white/10'
                            : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                        }`}
                      >
                        Key / value
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setAddUsageForm((f) => {
                            if (f.contextMode === 'json') return f;
                            const built = buildContextFromKvRows(f.contextKvRows);
                            return {
                              ...f,
                              contextMode: 'json',
                              contextJson: built ? JSON.stringify(built, null, 2) : '',
                            };
                          })
                        }
                        className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                          addUsageForm.contextMode === 'json'
                            ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5 dark:bg-gray-700 dark:text-white dark:ring-white/10'
                            : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                        }`}
                      >
                        JSON
                      </button>
                    </div>
                  </div>
                  {addUsageForm.contextMode === 'kv' ? (
                    <div className="mt-5 space-y-4">
                      {addUsageForm.contextKvRows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white/70 py-12 text-center dark:border-gray-600 dark:bg-gray-900/50">
                          <p className="text-sm text-gray-500 dark:text-gray-400">No optional context fields yet.</p>
                          <button
                            type="button"
                            onClick={() =>
                              setAddUsageForm((f) => ({
                                ...f,
                                contextKvRows: [...f.contextKvRows, newUsageContextKvRow()],
                              }))
                            }
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add field
                          </button>
                        </div>
                      ) : (
                        addUsageForm.contextKvRows.map((row) => (
                          <div
                            key={row.id}
                            className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm ring-1 ring-gray-900/[0.04] dark:border-gray-600 dark:bg-gray-900/60 dark:ring-white/[0.06]"
                          >
                            {rowUsesNotesValueEditor(row) ? (
                              <>
                                <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gradient-to-r from-gray-50/90 to-transparent px-4 py-2.5 dark:border-gray-700 dark:from-gray-800/40">
                                  <span className="text-sm font-semibold text-gray-900 dark:text-white">Notes</span>
                                  <button
                                    type="button"
                                    title="Remove notes"
                                    onClick={() =>
                                      setAddUsageForm((f) => ({
                                        ...f,
                                        contextKvRows: f.contextKvRows.filter((r) => r.id !== row.id),
                                      }))
                                    }
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                                  >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                      />
                                    </svg>
                                  </button>
                                </div>
                                <div className="p-4">
                                  <textarea
                                    value={row.value}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setAddUsageForm((f) => ({
                                        ...f,
                                        contextKvRows: f.contextKvRows.map((r) =>
                                          r.id === row.id ? { ...r, value: v } : r
                                        ),
                                      }));
                                    }}
                                    rows={4}
                                    placeholder="Optional notes for this usage…"
                                    className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
                                  />
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex items-end justify-between gap-3 border-b border-gray-100 bg-gradient-to-r from-gray-50/90 to-transparent px-4 py-3 dark:border-gray-700 dark:from-gray-800/40">
                                  <div className="min-w-0 flex-1">
                                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                      Field name
                                    </label>
                                    <input
                                      type="text"
                                      value={row.key}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setAddUsageForm((f) => ({
                                          ...f,
                                          contextKvRows: f.contextKvRows.map((r) =>
                                            r.id === row.id ? { ...r, key: v } : r
                                          ),
                                        }));
                                      }}
                                      placeholder="e.g. label, referenceId"
                                      className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    title="Remove field"
                                    onClick={() =>
                                      setAddUsageForm((f) => ({
                                        ...f,
                                        contextKvRows: f.contextKvRows.filter((r) => r.id !== row.id),
                                      }))
                                    }
                                    className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                                  >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                      />
                                    </svg>
                                  </button>
                                </div>
                                <div className="space-y-1.5 px-4 py-3">
                                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                    Value
                                  </label>
                                  <input
                                    type="text"
                                    value={row.value}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setAddUsageForm((f) => ({
                                        ...f,
                                        contextKvRows: f.contextKvRows.map((r) =>
                                          r.id === row.id ? { ...r, value: v } : r
                                        ),
                                      }));
                                    }}
                                    placeholder="Text, number, true / false / null, or JSON"
                                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        ))
                      )}
                      {addUsageForm.contextKvRows.length > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setAddUsageForm((f) => ({
                              ...f,
                              contextKvRows: [...f.contextKvRows, newUsageContextKvRow()],
                            }))
                          }
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-3 text-sm font-medium text-gray-600 transition-colors hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700 dark:border-gray-600 dark:text-gray-300 dark:hover:border-blue-500/40 dark:hover:bg-blue-950/20 dark:hover:text-blue-300 sm:w-auto sm:px-5"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add another field
                        </button>
                      ) : null}
                      <details className="group rounded-xl border border-gray-200/90 bg-white/60 dark:border-gray-600 dark:bg-gray-900/40">
                        <summary className="cursor-pointer list-none px-4 py-2.5 text-xs font-medium text-gray-600 marker:hidden dark:text-gray-400 [&::-webkit-details-marker]:hidden">
                          <span className="inline-flex items-center gap-1.5">
                            Value formatting hints
                            <svg
                              className="h-3.5 w-3.5 text-gray-400 transition-transform group-open:rotate-180"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </span>
                        </summary>
                        <p className="border-t border-gray-100 px-4 pb-3 pt-0 text-xs leading-relaxed text-gray-500 dark:border-gray-700 dark:text-gray-400">
                          Non-<span className="font-medium text-gray-600 dark:text-gray-300">notes</span> values accept plain text,
                          booleans (<code className="rounded bg-gray-100 px-0.5 dark:bg-gray-800">true</code> /{' '}
                          <code className="rounded bg-gray-100 px-0.5 dark:bg-gray-800">false</code> /{' '}
                          <code className="rounded bg-gray-100 px-0.5 dark:bg-gray-800">null</code>), numbers, or JSON objects/arrays.
                          The <span className="font-medium text-gray-600 dark:text-gray-300">notes</span> field is always sent as text.
                        </p>
                      </details>
                    </div>
                  ) : (
                    <div className="mt-5">
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        Raw JSON object
                      </label>
                      <textarea
                        value={addUsageForm.contextJson}
                        onChange={(e) => setAddUsageForm((f) => ({ ...f, contextJson: e.target.value }))}
                        rows={8}
                        spellCheck={false}
                        className="w-full rounded-xl border border-gray-200 bg-gray-950/[0.03] px-4 py-3 font-mono text-sm leading-relaxed text-gray-900 shadow-inner transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-black/20 dark:text-gray-100"
                        placeholder={'{\n  "label": "…",\n  "description": "…"\n}'}
                      />
                    </div>
                  )}
                </div>
                <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-6 dark:border-gray-800 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    disabled={addUsageSubmitting}
                    onClick={() => setShowAddUsageModal(false)}
                    className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addUsageSubmitting}
                    className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:shadow-blue-500/20 dark:hover:bg-blue-600"
                  >
                    {addUsageSubmitting ? 'Adding…' : 'Add usage'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Update Subscription Usage Modal */}
        {showUpdateUsageModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowUpdateUsageModal(false)}>
            <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 m-4" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-900 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Update Subscription Usage</h2>
                <button
                  onClick={() => {
                    setShowUpdateUsageModal(false);
                    setSelectedServiceRequestForUsage(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-6">
                {error && (
                  <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Service Request *
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Only service requests with types matching your subscription benefits are shown.
                  </p>
                  {loadingRequests ? (
                    <div className="text-center text-gray-600 dark:text-gray-400 py-4">Loading service requests...</div>
                  ) : (() => {
                    // Filter service requests to only show those whose types match subscription usage keys
                    const allowedTypes = subscriptionUsage ? Object.keys(subscriptionUsage) : [];
                    const filteredRequests = serviceRequests.filter(req => 
                      allowedTypes.includes(req.type)
                    );

                    if (filteredRequests.length === 0) {
                      return (
                        <div className="text-center text-gray-600 dark:text-gray-400 py-4">
                          No service requests available that match your subscription benefits.
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {filteredRequests.map((request) => (
                          <div
                            key={request.id}
                            onClick={() => setSelectedServiceRequestForUsage(request)}
                            className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                              selectedServiceRequestForUsage?.id === request.id
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {formatTypeLabel(request.type)}
                                  </span>
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                    request.status === 'COMPLETED'
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                                      : request.status === 'PENDING'
                                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
                                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                  }`}>
                                    {formatStatusLabel(request.status)}
                                  </span>
                                </div>
                                
                                {/* Created Date */}
                                {(request.created ?? request.context?.created) && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Created:</span>
                                    <span className="text-xs text-gray-700 dark:text-gray-300">
                                      {formatDate(request.created ?? request.context?.created, { includeTime: true })}
                                    </span>
                                  </div>
                                )}

                                {/* Pricing Info */}
                                {request.pricingInfo && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Price:</span>
                                    <span className="text-xs font-semibold text-gray-900 dark:text-white">
                                      {typeof request.pricingInfo.currency === 'string' 
                                        ? request.pricingInfo.currency 
                                        : request.pricingInfo.currency.code} {formatAmount(request.pricingInfo.price)}
                                    </span>
                                  </div>
                                )}

                                {/* Invoice Details */}
                                {request.invoice ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Invoice:</span>
                                      <span className="text-xs font-semibold text-gray-900 dark:text-white">
                                        {request.invoice.number}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Invoice Status:</span>
                                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                        request.invoice.status === 'PAID'
                                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                                          : request.invoice.status === 'UNPAID'
                                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
                                          : request.invoice.status === 'CANCELLED'
                                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                      }`}>
                                        {request.invoice.status || 'N/A'}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Invoice:</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 italic">No invoice</span>
                                  </div>
                                )}

                                {/* Request ID (smaller, at bottom) */}
                                <p className="text-xs text-gray-400 dark:text-gray-500 pt-1 border-t border-gray-200 dark:border-gray-700">
                                  ID: {request.id}
                                </p>
                              </div>
                              {selectedServiceRequestForUsage?.id === request.id && (
                                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setShowUpdateUsageModal(false);
                      setSelectedServiceRequestForUsage(null);
                    }}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    disabled={updatingUsage}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateUsage}
                    disabled={!selectedServiceRequestForUsage || updatingUsage}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600"
                  >
                    {updatingUsage ? 'Updating...' : 'Update Usage'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

