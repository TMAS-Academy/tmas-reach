import { useMemo, useState } from 'react'
import type { Campaign, Contact, EmailTemplate } from '../../types'
import { store } from '../../lib/store'
import { ModalShell } from '../ui/ModalShell'
import { AlertTriangle, Users } from 'lucide-react'

interface CampaignModalProps {
  templates: EmailTemplate[]
  contacts: Contact[]
  campaign?: Campaign | null
  onClose: () => void
  onSaved: (message: string) => void
}

const DEFAULT_TAGS = ['high_school', 'middle_school', 'district_admin', 'educators', 'nonprofit']

export function CampaignModal({
  templates,
  contacts,
  campaign,
  onClose,
  onSaved,
}: CampaignModalProps) {
  const [name, setName] = useState(campaign?.name || '')
  const [templateId, setTemplateId] = useState(campaign?.template_id || templates[0]?.id || '')
  const [targetAudienceTag, setTargetAudienceTag] = useState(
    campaign ? campaign.target_audience_tag || 'all' : 'all'
  )
  const [batchSize, setBatchSize] = useState(campaign?.batch_size || 50)
  const [error, setError] = useState<string | null>(null)

  const audienceTags = useMemo(() => {
    const tagSet = new Set<string>(DEFAULT_TAGS)
    contacts.forEach((c) => {
      if (c.audience_tag?.trim()) tagSet.add(c.audience_tag.trim())
    })
    return Array.from(tagSet).sort()
  }, [contacts])

  const eligibleActiveCount = useMemo(() => {
    return contacts.filter(
      (c) =>
        c.status === 'active' &&
        (targetAudienceTag === 'all' || c.audience_tag === targetAudienceTag)
    ).length
  }, [contacts, targetAudienceTag])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Campaign name is required.')
      return
    }
    if (!templateId) {
      setError('An email template must be selected.')
      return
    }
    if (batchSize <= 0 || batchSize > 500) {
      setError('Batch size must be between 1 and 500 recipients.')
      return
    }

    if (campaign) {
      const res = store.updateCampaign(campaign.id, {
        name: name.trim(),
        template_id: templateId,
        target_audience_tag: targetAudienceTag === 'all' ? undefined : targetAudienceTag,
        batch_size: batchSize,
      })
      if (!res.success) {
        setError(res.error || 'Failed to update campaign.')
        return
      }
      onSaved('Campaign updated and set to draft.')
    } else {
      store.addCampaign({
        name: name.trim(),
        template_id: templateId,
        target_audience_tag: targetAudienceTag === 'all' ? undefined : targetAudienceTag,
        batch_size: batchSize,
        created_by: store.getCurrentUser().id,
      })
      onSaved('Draft campaign created.')
    }
  }

  const inputClass =
    'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'

  return (
    <ModalShell
      onClose={onClose}
      title={campaign ? 'Edit Campaign' : 'Create Outreach Campaign'}
      subtitle="Campaigns start in draft and require Lead or Administrator approval before dispatch."
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="campaignForm"
            disabled={templates.length === 0}
            className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-50 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 transition-colors"
          >
            {campaign ? 'Save Draft' : 'Create Campaign'}
          </button>
        </>
      }
    >
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300"
        >
          {error}
        </div>
      )}

      {templates.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            No email templates available
          </div>
          <p className="mt-1">
            Create at least one email template on the Templates tab before creating a campaign.
          </p>
        </div>
      ) : (
        <form id="campaignForm" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="campaign-name"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
            >
              Campaign Name *
            </label>
            <input
              id="campaign-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q4 District Leadership Outreach"
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="campaign-template"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
            >
              Email Template *
            </label>
            <select
              id="campaign-template"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className={inputClass}
            >
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="campaign-audience"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
              >
                Target Audience Tag
              </label>
              <select
                id="campaign-audience"
                value={targetAudienceTag}
                onChange={(e) => setTargetAudienceTag(e.target.value)}
                className={inputClass}
              >
                <option value="all">All Audiences</option>
                {audienceTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="campaign-batch-size"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
              >
                Batch Size (1-500)
              </label>
              <input
                id="campaign-batch-size"
                type="number"
                min={1}
                max={500}
                value={batchSize}
                onChange={(e) => setBatchSize(parseInt(e.target.value, 10) || 50)}
                className={inputClass}
              />
            </div>
          </div>

          <div
            className={`flex items-center gap-2 rounded-lg border p-3 text-xs ${
              eligibleActiveCount > 0
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
            }`}
          >
            <Users className="h-4 w-4 shrink-0" />
            <span>
              <strong>{eligibleActiveCount}</strong> active contact
              {eligibleActiveCount === 1 ? '' : 's'} currently match this audience
              {eligibleActiveCount === 0
                ? ' (at least 1 active contact is required before approval).'
                : '.'}
            </span>
          </div>
        </form>
      )}
    </ModalShell>
  )
}
