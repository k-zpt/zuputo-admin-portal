'use client';

import { AdminLayout } from '@/components/AdminLayout';
import { Tabs } from '@/components/Tabs';
import { ConfigJsonPanel } from '@/components/system-jobs/ConfigJsonPanel';
import { JobNameCombobox } from '@/components/system-jobs/JobNameCombobox';
import { JobsRegistryPanel } from '@/components/system-jobs/JobsRegistryPanel';
import { MechanismActions } from '@/components/system-jobs/MechanismActions';
import { RegisterJobPanel } from '@/components/system-jobs/RegisterJobPanel';
import { RenewalOffsetsField } from '@/components/system-jobs/RenewalOffsetsField';
import { SectionCard } from '@/components/system-jobs/SectionCard';
import { SpawnTimeFields } from '@/components/system-jobs/SpawnTimeFields';
import { systemJobService } from '@/lib/api/services';
import {
  extractJobNamesFromConfig,
  offsetsFromConfig,
  pickNumber,
} from '@/lib/systemJobs';
import type {
  ApiResponse,
  BackgroundJobConfig,
  CreateBackgroundJobPayload,
  SystemJobRecord,
} from '@/lib/api/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

export default function SystemJobsPage() {
  const [activeTab, setActiveTab] = useState('config');
  const [jobConfig, setJobConfig] = useState<BackgroundJobConfig | null>(null);
  const [jobsList, setJobsList] = useState<SystemJobRecord[]>([]);
  const [jobsLoadError, setJobsLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const [offsetsInput, setOffsetsInput] = useState('');
  const [spawnHour, setSpawnHour] = useState(0);
  const [spawnMinute, setSpawnMinute] = useState(0);
  const [triggerJobName, setTriggerJobName] = useState('subscription_renewal');

  const [createForm, setCreateForm] = useState<CreateBackgroundJobPayload>({
    name: '',
    description: '',
    status: 'ACTIVE',
  });

  const applyConfigPayload = useCallback((data: BackgroundJobConfig) => {
    setJobConfig(data);
    const o = offsetsFromConfig(data);
    if (o) setOffsetsInput(o);
    const h = pickNumber(data, ['spawnHour', 'hour', 'spawn_hour']);
    const m = pickNumber(data, ['spawnMinute', 'minute', 'spawn_minute']);
    if (h !== undefined) setSpawnHour(h);
    if (m !== undefined) setSpawnMinute(m);
  }, []);

  const refreshAll = useCallback(async () => {
    setError(null);
    const [configResult, jobsResult] = await Promise.allSettled([
      systemJobService.getConfig(),
      systemJobService.list(),
    ]);

    if (configResult.status === 'fulfilled') {
      const res: ApiResponse<BackgroundJobConfig> = configResult.value;
      applyConfigPayload(res.data);
    } else {
      const msg =
        configResult.reason instanceof Error
          ? configResult.reason.message
          : 'Failed to load job config';
      setError(msg);
    }

    if (jobsResult.status === 'fulfilled') {
      setJobsLoadError(null);
      const res: ApiResponse<SystemJobRecord[]> = jobsResult.value;
      const raw = res.data;
      setJobsList(Array.isArray(raw) ? raw : []);
    } else {
      setJobsList([]);
      setJobsLoadError(
        jobsResult.reason instanceof Error
          ? jobsResult.reason.message
          : 'Failed to load jobs list'
      );
    }
  }, [applyConfigPayload]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await refreshAll();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshAll]);

  const runAction = async (
    key: string,
    fn: () => Promise<unknown>,
    opts?: { skipConfigReload?: boolean }
  ) => {
    setToast(null);
    setPending(key);
    try {
      await fn();
      setToast({ type: 'ok', text: 'Request completed successfully.' });
      if (!opts?.skipConfigReload) {
        await refreshAll();
      }
    } catch (e) {
      setToast({
        type: 'err',
        text: e instanceof Error ? e.message : 'Request failed',
      });
    } finally {
      setPending(null);
    }
  };

  const knownJobNames = useMemo(() => {
    const fromConfig = extractJobNamesFromConfig(jobConfig);
    const fromList = jobsList
      .map((j) => (typeof j.name === 'string' ? j.name.trim() : ''))
      .filter(Boolean);
    return Array.from(new Set([...fromConfig, ...fromList])).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [jobConfig, jobsList]);

  const anyPending = !!pending;

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-gray-600 dark:text-gray-400">
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent dark:border-blue-400"
            aria-hidden
          />
          <p className="text-sm font-medium">Loading job configuration…</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-8">
        <header className="relative overflow-hidden rounded-2xl border border-blue-100/80 bg-gradient-to-br from-blue-50/90 via-white to-violet-50/50 px-8 py-8 dark:border-blue-900/30 dark:from-blue-950/40 dark:via-gray-900 dark:to-violet-950/20">
          <div className="relative max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              System
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              Background jobs
            </h1>
            <p className="mt-3 text-base leading-relaxed text-gray-600 dark:text-gray-400">
              Manage scheduler settings, renewals, registered jobs, and day-to-day operations.
            </p>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50/90 px-5 py-4 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100">
            {error}
          </div>
        ) : null}

        {toast ? (
          <div
            className={`flex items-start justify-between gap-4 rounded-2xl border px-5 py-4 ${
              toast.type === 'ok'
                ? 'border-emerald-200 bg-emerald-50/90 text-emerald-950 dark:border-emerald-800/50 dark:bg-emerald-950/25 dark:text-emerald-100'
                : 'border-red-200 bg-red-50/90 text-red-950 dark:border-red-900/50 dark:bg-red-950/25 dark:text-red-100'
            }`}
          >
            <p className="text-sm font-medium">{toast.text}</p>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-current opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        <div className="rounded-2xl border border-gray-200/80 bg-white/60 px-4 py-2 shadow-sm dark:border-gray-800 dark:bg-gray-900/40 sm:px-6">
          <Tabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabs={[
              {
                id: 'config',
                label: 'Config & schedule',
                content: (
                  <div className="mx-auto max-w-4xl space-y-8 pb-4">
                    <SectionCard
                      title="Configuration snapshot"
                      description="Current scheduler settings as returned by the server."
                    >
                      <ConfigJsonPanel
                        jobConfig={jobConfig}
                        pending={pending === 'refresh'}
                        onRefresh={() =>
                          runAction('refresh', refreshAll, { skipConfigReload: true })
                        }
                      />
                    </SectionCard>

                    <SectionCard
                      title="Schedule & renewals"
                      description="Control when batch work runs and how far in advance renewal actions fire."
                    >
                      <div className="space-y-10">
                        <div>
                          <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
                            Renewal offsets
                          </h3>
                          <RenewalOffsetsField
                            value={offsetsInput}
                            onChange={setOffsetsInput}
                            savePending={pending === 'offsets'}
                            onSave={(offsets) =>
                              runAction('offsets', () =>
                                systemJobService.updateRenewalOffsets({ offsets })
                              )
                            }
                          />
                        </div>
                        <div className="border-t border-gray-100 pt-10 dark:border-gray-800">
                          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
                            Daily spawn time
                          </h3>
                          <SpawnTimeFields
                            hour={spawnHour}
                            minute={spawnMinute}
                            onHourChange={setSpawnHour}
                            onMinuteChange={setSpawnMinute}
                            disabled={anyPending}
                            saving={pending === 'spawnTime'}
                            onSave={() =>
                              runAction('spawnTime', () =>
                                systemJobService.updateSpawnTime({
                                  hour: spawnHour,
                                  minute: spawnMinute,
                                })
                              )
                            }
                          />
                        </div>
                      </div>
                    </SectionCard>
                  </div>
                ),
              },
              {
                id: 'operations',
                label: 'Operations',
                content: (
                  <div className="mx-auto max-w-3xl space-y-8 pb-4">
                    <SectionCard
                      title="Scheduler mechanism"
                      description="Global switches for the background job runner."
                    >
                      <MechanismActions
                        pending={pending}
                        onEnable={() =>
                          runAction('enable', () => systemJobService.enable())
                        }
                        onDisable={() =>
                          runAction('disable', () => systemJobService.disable())
                        }
                        onTriggerSpawn={() =>
                          runAction('triggerSpawn', () =>
                            systemJobService.triggerSpawn()
                          )
                        }
                      />
                    </SectionCard>

                    <SectionCard
                      title="Run & register jobs"
                      description="Trigger a single job by name or add a new job definition to the system."
                    >
                      <div className="space-y-10">
                        <div>
                          <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
                            Trigger one job
                          </h3>
                          <JobNameCombobox
                            value={triggerJobName}
                            onChange={setTriggerJobName}
                            knownJobNames={knownJobNames}
                            pending={pending === 'triggerJob'}
                            onTrigger={() =>
                              runAction('triggerJob', () =>
                                systemJobService.triggerJob(triggerJobName.trim())
                              )
                            }
                          />
                        </div>
                        <div className="border-t border-gray-100 pt-10 dark:border-gray-800">
                          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                            New job registration
                          </h3>
                          <RegisterJobPanel
                            form={createForm}
                            onChange={setCreateForm}
                            disabled={anyPending}
                            saving={pending === 'create'}
                            onSubmit={() =>
                              runAction('create', () =>
                                systemJobService.create({
                                  name: createForm.name.trim(),
                                  description: createForm.description.trim(),
                                  status: createForm.status,
                                })
                              )
                            }
                          />
                        </div>
                      </div>
                    </SectionCard>
                  </div>
                ),
              },
              {
                id: 'jobs',
                label: 'Job registry',
                content: (
                  <div className="mx-auto max-w-5xl pb-4">
                    <SectionCard
                      title="Registered jobs"
                      description="Jobs known to the system. Names appear as suggestions when you trigger a job."
                    >
                      <JobsRegistryPanel
                        jobs={jobsList}
                        loadError={jobsLoadError}
                        refreshing={pending === 'refresh'}
                        onRefresh={() =>
                          runAction('refresh', refreshAll, { skipConfigReload: true })
                        }
                      />
                    </SectionCard>
                  </div>
                ),
              },
            ]}
          />
        </div>
      </div>
    </AdminLayout>
  );
}
