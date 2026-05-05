'use client';

import { AdminLayout } from "@/components/AdminLayout";
import { subscriptionPlanService, countryService, currencyService } from "@/lib/api/services";
import { useState, useEffect, useMemo } from "react";
import type { SubscriptionPlan, Country, Currency, ApiResponse, CreateSubscriptionPlanPayload, UpdateSubscriptionPlanPayload, PlanBenefit, BillingFrequency } from "@/lib/api/types";

// Service type enum values and their human-readable labels
const SERVICE_TYPES = {
  AD_HOC: 'Ad Hoc',
  IP_REGISTRATION: 'IP Registration',
  TRADEMARK_REGISTRATION: 'Trademark Registration',
  CONTRACT_REQUEST: 'Contract Request',
  CONTRACT_REVIEW: 'Contract Review',
  COMPANY_INCORPORATION: 'Company Incorporation',
  SOLE_PROPRIETORSHIP_INCORPORATION: 'Sole Proprietorship Incorporation',
} as const;

type ServiceType = keyof typeof SERVICE_TYPES;

// Helper function to format service type for display
const formatServiceType = (serviceType: string): string => {
  return SERVICE_TYPES[serviceType as ServiceType] || serviceType;
};

/** Currency id for plan forms; supports camelCase or snake_case country payloads. */
function resolveCountryDefaultCurrencyId(country: Country): string | undefined {
  const raw = country.defaultCurrency ?? country.default_currency;
  if (raw == null) return undefined;
  if (typeof raw === 'string') return raw;
  return raw.id;
}

/** Options for the plan currency dropdown: country.currencies + default, deduped; enriched from global list when needed. */
function embeddedCurrenciesToList(
  country: Country | undefined,
  globalCurrencies: Currency[]
): Currency[] {
  if (!country) return [];
  const out: Currency[] = [];
  const seen = new Set<string>();
  const push = (cur: Currency | null | undefined) => {
    if (!cur?.id) return;
    if (seen.has(cur.id)) return;
    seen.add(cur.id);
    out.push(cur);
  };

  const rows = country.currencies ?? [];
  for (const c of rows as (Currency | string)[]) {
    if (typeof c === 'string') {
      push(
        globalCurrencies.find((g) => g.id === c) ?? {
          id: c,
          name: c,
          label: c,
          code: c,
        }
      );
    } else {
      push(c);
    }
  }

  const raw = country.defaultCurrency ?? country.default_currency;
  if (raw != null) {
    if (typeof raw === 'string') {
      push(
        globalCurrencies.find((g) => g.id === raw) ?? {
          id: raw,
          name: raw,
          label: raw,
          code: raw,
        }
      );
    } else {
      push(raw);
    }
  }

  return out;
}

export default function SubscriptionPlansClient() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateSubscriptionPlanPayload>({
    code: '',
    label: '',
    country: '',
    active: true,
    billingFrequency: 'MONTHLY',
    pricingInfo: {
      price: 0,
      currency: '',
    },
    description: '',
    features: [],
    benefits: [],
  });
  const [newFeature, setNewFeature] = useState('');
  const [newBenefit, setNewBenefit] = useState<Partial<PlanBenefit>>({
    serviceType: '',
    description: '',
    active: true,
    limit: 0,
    discountPercent: 0,
  });
  /** String drafts avoid forced "0" in controlled number inputs (leading zeros, can't clear). */
  const [priceInput, setPriceInput] = useState('');
  const [benefitLimitInput, setBenefitLimitInput] = useState('');
  const [benefitDiscountInput, setBenefitDiscountInput] = useState('');
  const [editingBenefitIndex, setEditingBenefitIndex] = useState<number | null>(null);
  const [editingFeatureIndex, setEditingFeatureIndex] = useState<number | null>(null);

  const selectedCountry = useMemo(
    () => countries.find((c) => c.id === formData.country),
    [countries, formData.country]
  );

  const planCurrencyOptions = useMemo(() => {
    let list = embeddedCurrenciesToList(selectedCountry, currencies);
    const curId = formData.pricingInfo?.currency?.trim();
    if (curId && !list.some((c) => c.id === curId)) {
      const g = currencies.find((x) => x.id === curId);
      if (g) list = [...list, g];
    }
    return list;
  }, [selectedCountry, currencies, formData.pricingInfo?.currency]);

  /** If countries arrive after the form opens, apply default currency when still unset. */
  useEffect(() => {
    const countryId = formData.country;
    if (!countryId || countries.length === 0) return;
    const country = countries.find((c) => c.id === countryId);
    if (!country) return;
    const def = resolveCountryDefaultCurrencyId(country);
    if (!def) return;
    setFormData((prev) => {
      if (prev.country !== countryId) return prev;
      if (prev.pricingInfo?.currency) return prev;
      return {
        ...prev,
        pricingInfo: { ...prev.pricingInfo, currency: def },
      };
    });
  }, [countries, formData.country]);

  useEffect(() => {
    loadPlans();
    loadCountries();
  }, []);

  useEffect(() => {
    if (showCreateForm || editingPlanId) {
      loadCurrencies();
    }
  }, [showCreateForm, editingPlanId]);

  useEffect(() => {
    if (searchQuery) {
      loadPlans();
    } else {
      loadPlans();
    }
  }, [searchQuery]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = searchQuery ? { q: searchQuery } : {};
      const response: ApiResponse<SubscriptionPlan[]> = await subscriptionPlanService.list(params);
      setPlans(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  const loadCountries = async () => {
    try {
      const response: ApiResponse<Country[]> = await countryService.list({ limit: 100 });
      setCountries(response.data);
    } catch (err) {
      console.error('Failed to load countries:', err);
    }
  };

  const loadCurrencies = async () => {
    try {
      setLoadingCurrencies(true);
      const response: ApiResponse<Currency[]> = await currencyService.list({ limit: 100 });
      setCurrencies(response.data);
    } catch (err) {
      console.error('Failed to load currencies:', err);
    } finally {
      setLoadingCurrencies(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = parseFloat(priceInput);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError('Please enter a valid price greater than zero.');
      return;
    }
    if (!formData.pricingInfo?.currency?.trim()) {
      setError('Please select a currency.');
      return;
    }
    try {
      setError(null);
      setSuccess(null);
      const c = (formData.code ?? '').trim();
      await subscriptionPlanService.create({
        ...formData,
        code: c ? c.toUpperCase() : '',
        pricingInfo: {
          ...formData.pricingInfo,
          price: parsedPrice,
        },
      });
      setShowCreateForm(false);
      resetForm();
      setSuccess('Subscription plan created successfully!');
      loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create subscription plan');
    }
  };

  const handleEdit = (plan: SubscriptionPlan) => {
    // Extract country ID (could be string, Country object, or undefined)
    const countryId = !plan.country 
      ? '' 
      : typeof plan.country === 'string' 
        ? plan.country 
        : plan.country.id || '';
    
    // Extract currency ID from pricing info
    const currencyId = typeof plan.pricingInfo?.currency === 'string' 
      ? plan.pricingInfo.currency 
      : plan.pricingInfo?.currency?.id || '';

    setFormData({
      code: plan.code,
      label: plan.label,
      country: countryId,
      active: plan.active,
      billingFrequency: plan.billingFrequency || 'MONTHLY',
      pricingInfo: {
        price: plan.pricingInfo?.price || 0,
        currency: currencyId,
      },
      description: plan.description || '',
      features: plan.features || [],
      benefits: plan.benefits || [],
    });
    setEditingPlanId(plan.id);
    setShowCreateForm(false);
    setError(null);
    setSuccess(null);
    setPriceInput(
      plan.pricingInfo?.price !== undefined && plan.pricingInfo.price !== null
        ? String(plan.pricingInfo.price)
        : ''
    );
    setNewBenefit({
      serviceType: '',
      description: '',
      active: true,
      limit: 0,
      discountPercent: 0,
    });
    setBenefitLimitInput('');
    setBenefitDiscountInput('');
    setEditingBenefitIndex(null);
    setEditingFeatureIndex(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlanId) return;

    const submitPrice = parseFloat(priceInput);
    if (!Number.isFinite(submitPrice) || submitPrice <= 0) {
      setError('Please enter a valid price greater than zero.');
      return;
    }
    if (!formData.pricingInfo?.currency?.trim()) {
      setError('Please select a currency.');
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      
      const plan = plans.find(p => p.id === editingPlanId);
      if (!plan) return;
      
      const payload: UpdateSubscriptionPlanPayload = {};
      
      // Only include changed fields
      const countryId = !plan.country 
        ? '' 
        : typeof plan.country === 'string' 
          ? plan.country 
          : plan.country.id || '';
      if (formData.country !== countryId) {
        payload.country = formData.country;
      }
      
      if (formData.active !== plan.active) {
        payload.active = formData.active;
      }
      
      if (formData.label !== plan.label) {
        payload.label = formData.label;
      }
      
      if (formData.description !== (plan.description || '')) {
        payload.description = formData.description || undefined;
      }
      
      // Compare billing frequency
      const currentBillingFrequency = plan.billingFrequency || 'MONTHLY';
      if (formData.billingFrequency !== currentBillingFrequency) {
        payload.billingFrequency = formData.billingFrequency;
      }
      
      // Compare features
      const currentFeatures = (plan.features || []).sort();
      const newFeatures = (formData.features || []).sort();
      if (JSON.stringify(currentFeatures) !== JSON.stringify(newFeatures)) {
        payload.features = formData.features;
      }
      
      // Compare pricing info
      const currentPrice = plan.pricingInfo?.price || 0;
      const currentCurrencyId = typeof plan.pricingInfo?.currency === 'string'
        ? plan.pricingInfo.currency
        : plan.pricingInfo?.currency?.id || '';
      
      if (submitPrice !== currentPrice || 
          formData.pricingInfo.currency !== currentCurrencyId) {
        payload.pricingInfo = {
          price: submitPrice,
          currency: formData.pricingInfo.currency,
        };
      }
      
      // Send only newly added benefits (backend adds these; sending full list would duplicate existing)
      const existingServiceTypes = new Set((plan.benefits || []).map((b) => b.serviceType));
      const newBenefitsToAdd = (formData.benefits || []).filter(
        (fb) => !existingServiceTypes.has(fb.serviceType)
      );
      if (newBenefitsToAdd.length > 0) {
        payload.benefits = newBenefitsToAdd;
      }
      
      await subscriptionPlanService.update(editingPlanId, payload);
      setEditingPlanId(null);
      resetForm();
      setSuccess('Subscription plan updated successfully!');
      loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update subscription plan');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      label: '',
      country: '',
      active: true,
      billingFrequency: 'MONTHLY',
      pricingInfo: {
        price: 0,
        currency: '',
      },
      description: '',
      features: [],
      benefits: [],
    });
    setNewFeature('');
    setNewBenefit({
      serviceType: '',
      description: '',
      active: true,
      limit: 0,
      discountPercent: 0,
    });
    setPriceInput('');
    setBenefitLimitInput('');
    setBenefitDiscountInput('');
    setEditingBenefitIndex(null);
    setEditingFeatureIndex(null);
  };

  const handleCancel = () => {
    setShowCreateForm(false);
    setEditingPlanId(null);
    resetForm();
    setError(null);
    setSuccess(null);
  };

  const addFeature = () => {
    const trimmed = newFeature.trim();
    if (!trimmed) return;
    if (editingFeatureIndex !== null) {
      const updated = [...(formData.features || [])];
      updated[editingFeatureIndex] = trimmed;
      setFormData({ ...formData, features: updated });
      setEditingFeatureIndex(null);
    } else {
      setFormData({
        ...formData,
        features: [...(formData.features || []), trimmed],
      });
    }
    setNewFeature('');
  };

  const startEditingFeature = (index: number) => {
    const feature = formData.features?.[index];
    if (feature !== undefined) {
      setNewFeature(feature);
      setEditingFeatureIndex(index);
    }
  };

  const cancelEditingFeature = () => {
    setEditingFeatureIndex(null);
    setNewFeature('');
  };

  const removeFeature = (index: number) => {
    setFormData({
      ...formData,
      features: formData.features?.filter((_, i) => i !== index) || [],
    });
    if (editingFeatureIndex === index) {
      cancelEditingFeature();
    } else if (editingFeatureIndex !== null && editingFeatureIndex > index) {
      setEditingFeatureIndex(editingFeatureIndex - 1);
    }
  };

  const addBenefit = () => {
    if (newBenefit.serviceType?.trim() && newBenefit.description?.trim()) {
      const limitParsed =
        benefitLimitInput === '' ? 0 : parseInt(benefitLimitInput, 10);
      const discountParsed =
        benefitDiscountInput === '' ? 0 : parseInt(benefitDiscountInput, 10);
      const limit = Number.isFinite(limitParsed) ? Math.max(0, limitParsed) : 0;
      const discountPercent = Number.isFinite(discountParsed)
        ? Math.min(100, Math.max(0, discountParsed))
        : 0;
      if (editingBenefitIndex !== null) {
        // Update existing benefit
        const updatedBenefits = [...(formData.benefits || [])];
        updatedBenefits[editingBenefitIndex] = {
          serviceType: newBenefit.serviceType.trim(),
          description: newBenefit.description.trim(),
          active: newBenefit.active ?? true,
          limit,
          discountPercent,
        };
        setFormData({
          ...formData,
          benefits: updatedBenefits,
        });
        setEditingBenefitIndex(null);
      } else {
        // Add new benefit
        setFormData({
          ...formData,
          benefits: [...(formData.benefits || []), {
            serviceType: newBenefit.serviceType.trim(),
            description: newBenefit.description.trim(),
            active: newBenefit.active ?? true,
            limit,
            discountPercent,
          }],
        });
      }
      setNewBenefit({
        serviceType: '',
        description: '',
        active: true,
        limit: 0,
        discountPercent: 0,
      });
      setBenefitLimitInput('');
      setBenefitDiscountInput('');
    }
  };

  const startEditingBenefit = (index: number) => {
    const benefit = formData.benefits?.[index];
    if (benefit) {
      setNewBenefit({
        serviceType: benefit.serviceType,
        description: benefit.description,
        active: benefit.active,
        limit: benefit.limit,
        discountPercent: benefit.discountPercent,
      });
      setBenefitLimitInput(
        benefit.limit !== undefined && benefit.limit !== null
          ? String(benefit.limit)
          : ''
      );
      setBenefitDiscountInput(
        benefit.discountPercent !== undefined && benefit.discountPercent !== null
          ? String(benefit.discountPercent)
          : ''
      );
      setEditingBenefitIndex(index);
    }
  };

  const cancelEditingBenefit = () => {
    setEditingBenefitIndex(null);
    setNewBenefit({
      serviceType: '',
      description: '',
      active: true,
      limit: 0,
      discountPercent: 0,
    });
    setBenefitLimitInput('');
    setBenefitDiscountInput('');
  };

  const removeBenefit = (index: number) => {
    setFormData({
      ...formData,
      benefits: formData.benefits?.filter((_, i) => i !== index) || [],
    });
    // If we're editing the benefit being removed, cancel editing
    if (editingBenefitIndex === index) {
      cancelEditingBenefit();
    } else if (editingBenefitIndex !== null && editingBenefitIndex > index) {
      // Adjust the editing index if a benefit before the one being edited is removed
      setEditingBenefitIndex(editingBenefitIndex - 1);
    }
  };

  const getCountryName = (country: string | Country | undefined): string => {
    if (!country) return 'N/A';
    if (typeof country === 'string') {
      const countryObj = countries.find(c => c.id === country);
      return countryObj?.name || country;
    }
    return country.name;
  };

  const getCurrencyCode = (currency: string | Currency | undefined): string => {
    if (!currency) return 'N/A';
    if (typeof currency === 'string') {
      const currencyObj = currencies.find(c => c.id === currency);
      return currencyObj?.code || currency;
    }
    return currency.code;
  };

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('en-US').format(price);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Subscription Plans
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Manage subscription plans and pricing
            </p>
          </div>
          <button
            onClick={() => {
              setShowCreateForm(true);
              setEditingPlanId(null);
              resetForm();
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Create Plan
          </button>
        </div>

        {/* Search */}
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search plans by code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
          />
        </div>

        {(showCreateForm || editingPlanId) && (
          <form
            onSubmit={editingPlanId ? handleUpdate : handleCreate}
            className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingPlanId ? 'Edit Subscription Plan' : 'Create Subscription Plan'}
              </h2>
              <button
                type="button"
                onClick={handleCancel}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Label *
                </label>
                <input
                  type="text"
                  required
                  value={formData.label || ''}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Code
                </label>
                <input
                  type="text"
                  value={formData.code || ''}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  disabled={!!editingPlanId}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400 dark:disabled:bg-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Country *
                </label>
                <select
                  required
                  value={formData.country || ''}
                  onChange={(e) => {
                    const countryId = e.target.value;
                    const selected = countries.find((c) => c.id === countryId);
                    const defaultCurId = selected
                      ? resolveCountryDefaultCurrencyId(selected)
                      : undefined;
                    setFormData((prev) => ({
                      ...prev,
                      country: countryId,
                      pricingInfo: {
                        ...prev.pricingInfo,
                        currency: defaultCurId ?? '',
                      },
                    }));
                  }}
                  className="mt-1 w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                >
                  <option value="">Select a country</option>
                  {countries.map((country) => (
                    <option key={country.id} value={country.id}>
                      {country.name} ({country.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Billing Frequency *
                </label>
                <select
                  required
                  value={formData.billingFrequency || 'MONTHLY'}
                  onChange={(e) => setFormData({ ...formData, billingFrequency: e.target.value as BillingFrequency })}
                  className="mt-1 w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="YEARLY">Yearly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="BIANNUAL">Bi-Annual</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="DAILY">Daily</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                />
                <label htmlFor="active" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Active
                </label>
              </div>
            </div>

            {/* Pricing Information */}
            <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Pricing Information</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Price *
                </label>
                <div className="mt-1 flex gap-2">
                  {!formData.country ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Select a country first. Currency choices are that country&apos;s supported currencies.
                    </p>
                  ) : planCurrencyOptions.length === 0 && loadingCurrencies ? (
                    <div className="text-sm text-gray-500 dark:text-gray-400">Loading currency details…</div>
                  ) : planCurrencyOptions.length === 0 ? (
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      No currencies on this country record. Configure them on the Countries page.
                    </p>
                  ) : (
                    <>
                      <select
                        required
                        value={formData.pricingInfo?.currency || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            pricingInfo: {
                              ...prev.pricingInfo,
                              currency: e.target.value,
                            },
                          }))
                        }
                        className="w-40 min-w-[10rem] appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                      >
                        <option value="">Currency</option>
                        {planCurrencyOptions.map((currency) => (
                          <option key={currency.id} value={currency.id}>
                            {currency.code}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={priceInput}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || /^\d*\.?\d*$/.test(value)) {
                            setPriceInput(value);
                            const n =
                              value === '' || value === '.'
                                ? 0
                                : parseFloat(value);
                            setFormData((prev) => ({
                              ...prev,
                              pricingInfo: {
                                ...prev.pricingInfo,
                                price: Number.isFinite(n) ? n : 0,
                              },
                            }));
                          }
                        }}
                        placeholder="Amount"
                        className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                      />
                    </>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
              />
            </div>

            {/* Features */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Features
              </label>
              <div className="space-y-2">
                {formData.features && formData.features.length > 0 && (
                  <div className="space-y-2">
                    {formData.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
                        <span className="flex-1 text-sm text-gray-900 dark:text-white">{feature}</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEditingFeature(index)}
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            title="Edit feature"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFeature(index)}
                            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            title="Remove feature"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addFeature();
                      }
                    }}
                    placeholder={
                      editingFeatureIndex !== null
                        ? 'Edit feature text and save'
                        : 'Enter a feature and press Enter'
                    }
                    className="min-w-[12rem] flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                  />
                  {editingFeatureIndex !== null && (
                    <button
                      type="button"
                      onClick={cancelEditingFeature}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={addFeature}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                  >
                    {editingFeatureIndex !== null ? 'Update Feature' : 'Add'}
                  </button>
                </div>
              </div>
            </div>

            {/* Benefits */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Benefits
              </label>
              <div className="space-y-2">
                {formData.benefits && formData.benefits.length > 0 && (
                  <div className="space-y-2">
                    {formData.benefits.map((benefit, index) => (
                      <div key={index} className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">{formatServiceType(benefit.serviceType)}</span>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                benefit.active
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                              }`}>
                                {benefit.active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{benefit.description}</p>
                            <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                              <span>Limit: {benefit.limit}</span>
                              <span>Discount: {benefit.discountPercent}%</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEditingBenefit(index)}
                              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                              title="Edit benefit"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              onClick={() => removeBenefit(index)}
                              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              title="Remove benefit"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Service Type *
                      </label>
                      <select
                        value={newBenefit.serviceType || ''}
                        onChange={(e) => setNewBenefit({ ...newBenefit, serviceType: e.target.value })}
                        className="w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                      >
                        <option value="">Select service type</option>
                        {Object.entries(SERVICE_TYPES).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Limit
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={benefitLimitInput}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '' || /^\d+$/.test(v)) setBenefitLimitInput(v);
                        }}
                        placeholder="e.g. 100"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description *
                    </label>
                    <input
                      type="text"
                      value={newBenefit.description || ''}
                      onChange={(e) => setNewBenefit({ ...newBenefit, description: e.target.value })}
                      placeholder="Benefit description"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Discount %
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={benefitDiscountInput}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '' || /^\d{1,3}$/.test(v)) {
                            const n = v === '' ? NaN : parseInt(v, 10);
                            if (v === '' || (Number.isFinite(n) && n <= 100))
                              setBenefitDiscountInput(v);
                          }
                        }}
                        placeholder="0–100"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <input
                        type="checkbox"
                        id="benefit-active"
                        checked={newBenefit.active ?? true}
                        onChange={(e) => setNewBenefit({ ...newBenefit, active: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                      />
                      <label htmlFor="benefit-active" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Active
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {editingBenefitIndex !== null && (
                      <button
                        type="button"
                        onClick={cancelEditingBenefit}
                        className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={addBenefit}
                      className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                    >
                      {editingBenefitIndex !== null ? 'Update Benefit' : 'Add Benefit'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                {editingPlanId ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        )}

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
            {success}
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-600 dark:text-gray-400">Loading...</div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Label
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Country
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Billing Frequency
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                  {plans.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                        No subscription plans found
                      </td>
                    </tr>
                  ) : (
                    plans.map((plan) => (
                      <tr key={plan.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                          {plan.code?.trim() ? plan.code : '—'}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                          {plan.label}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                          {getCountryName(plan.country)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                          {plan.billingFrequency || 'N/A'}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                          {plan.pricingInfo
                            ? `${getCurrencyCode(plan.pricingInfo.currency)} ${formatPrice(plan.pricingInfo.price)}`
                            : 'N/A'}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                            plan.active
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                          }`}>
                            {plan.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm">
                          <button
                            onClick={() => handleEdit(plan)}
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

