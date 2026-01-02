'use client';

import { AdminLayout } from "@/components/AdminLayout";
import { configService, countryService, currencyService } from "@/lib/api/services";
import { useState, useEffect } from "react";
import type { Config, UpdateConfigPayload, PricingConfig, ApiResponse, ConfigResponse, Country, Currency } from "@/lib/api/types";

export default function ConfigPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
    loadCountries();
    loadCurrencies();
  }, []);

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
      const response: ApiResponse<Currency[]> = await currencyService.list({ limit: 100 });
      setCurrencies(response.data);
    } catch (err) {
      console.error('Failed to load currencies:', err);
    }
  };

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const response: ApiResponse<ConfigResponse> = await configService.get();
      
      // Transform API response to form format
      const transformedConfig: Config = {
        trademarkClassificationPricing: response.data.trademarkClassificationPricing?.map(item => ({
          countryId: item.country.id,
          price: item.pricingInfo.price,
          currencyId: item.pricingInfo.currency.id,
        })) || [],
        trademarkClassPricing: response.data.trademarkClassPricing?.map(item => ({
          countryId: item.country.id,
          price: item.pricingInfo.price,
          currencyId: item.pricingInfo.currency.id,
        })) || [],
        trademarkSearchPricing: response.data.trademarkSearchPricing?.map(item => ({
          countryId: item.country.id,
          price: item.pricingInfo.price,
          currencyId: item.pricingInfo.currency.id,
        })) || [],
        contractReviewPricing: response.data.contractReviewPricing?.map(item => ({
          countryId: item.country.id,
          price: item.pricingInfo.price,
          currencyId: item.pricingInfo.currency.id,
        })) || [],
      };
      
      setConfig(transformedConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load config');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!config) return;

    try {
      setSaving(true);
      setError(null);
      const payload: UpdateConfigPayload = {
        trademarkClassificationPricing: config.trademarkClassificationPricing,
        trademarkClassPricing: config.trademarkClassPricing,
        trademarkSearchPricing: config.trademarkSearchPricing,
        contractReviewPricing: config.contractReviewPricing,
      };
      await configService.update(payload);
      await loadConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update config');
    } finally {
      setSaving(false);
    }
  };

  const updatePricing = (
    field: keyof Config,
    index: number,
    key: keyof PricingConfig,
    value: string
  ) => {
    if (!config) return;
    const pricing = config[field] || [];
    const updated = [...pricing];
    updated[index] = { ...(updated[index] || {}), [key]: value };
    
    // If country changed, clear currency if it's not supported by the new country
    if (key === 'countryId' && value) {
      const selectedCountry = countries.find(c => c.id === value);
      if (selectedCountry) {
        const currentCurrencyId = updated[index].currencyId;
        const supportedCurrencyCodes = selectedCountry.currencies.map(c => 
          typeof c === 'string' ? c : c.code
        );
        const currentCurrency = currencies.find(c => c.id === currentCurrencyId);
        const isCurrencySupported = currentCurrency && supportedCurrencyCodes.includes(currentCurrency.code);
        
        if (!isCurrencySupported) {
          updated[index].currencyId = '';
        }
      }
    }
    
    setConfig({ ...config, [field]: updated });
  };
  
  const getSupportedCurrencies = (countryId: string): Currency[] => {
    if (!countryId) return currencies;
    const country = countries.find(c => c.id === countryId);
    if (!country) return currencies;
    
    const supportedCurrencyCodes = country.currencies.map(c => 
      typeof c === 'string' ? c : c.code
    );
    
    return currencies.filter(c => supportedCurrencyCodes.includes(c.code));
  };

  const addPricing = (field: keyof Config) => {
    if (!config) return;
    const pricing = config[field] || [];
    setConfig({
      ...config,
      [field]: [...pricing, { countryId: '', price: '', currencyId: '' }],
    });
  };

  const removePricing = (field: keyof Config, index: number) => {
    if (!config) return;
    const pricing = config[field] || [];
    setConfig({
      ...config,
      [field]: pricing.filter((_, i) => i !== index),
    });
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-center text-gray-600 dark:text-gray-400">Loading...</div>
      </AdminLayout>
    );
  }

  if (!config) {
    return (
      <AdminLayout>
        <div className="text-center text-gray-600 dark:text-gray-400">No config found</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Config
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            System configuration and settings
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="space-y-8">
          {(['trademarkClassificationPricing', 'trademarkClassPricing', 'trademarkSearchPricing', 'contractReviewPricing'] as const).map((field) => (
            <div key={field} className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {field.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}
                </h2>
                <button
                  type="button"
                  onClick={() => addPricing(field)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  Add
                </button>
              </div>

              <div className="space-y-4">
                {(config[field] || []).map((pricing, index) => {
                  const supportedCurrencies = getSupportedCurrencies(pricing.countryId);
                  return (
                    <div key={index} className="flex gap-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                      <select
                        value={pricing.countryId}
                        onChange={(e) => updatePricing(field, index, 'countryId', e.target.value)}
                        className="flex-1 appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                      >
                        <option value="">Select Country</option>
                        {countries.map((country) => (
                          <option key={country.id} value={country.id}>
                            {country.name} ({country.code})
                          </option>
                        ))}
                      </select>
                      <select
                        value={pricing.currencyId}
                        onChange={(e) => updatePricing(field, index, 'currencyId', e.target.value)}
                        disabled={!pricing.countryId || supportedCurrencies.length === 0}
                        className="flex-1 appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400 dark:disabled:bg-gray-900 dark:disabled:text-gray-400"
                      >
                        <option value="">
                          {!pricing.countryId ? 'Select country first' : supportedCurrencies.length === 0 ? 'No currencies available' : 'Select Currency'}
                        </option>
                        {supportedCurrencies.map((currency) => (
                          <option key={currency.id} value={currency.id}>
                            {currency.label} ({currency.code})
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Price"
                        value={pricing.price}
                        onChange={(e) => updatePricing(field, index, 'price', e.target.value)}
                        className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                      />
                      <button
                        type="button"
                        onClick={() => removePricing(field, index)}
                        className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleUpdate}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {saving ? 'Saving...' : 'Save All Changes'}
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
