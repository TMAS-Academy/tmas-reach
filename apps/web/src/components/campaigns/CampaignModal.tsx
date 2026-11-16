import { useState } from 'react'
import { EmailTemplate } from '../../types'
import { store } from '../../lib/store'
import { X } from 'lucide-react'

interface CampaignModalProps {
  templates: EmailTemplate[]
  onClose: () => void
  onSaved: () => void
}

export function CampaignModal({ templates, onClose, onSaved }: CampaignModalProps) {
  const [name, setName] = useState('')
  const [templateId, setTemplateId] = useState(templates[0]?.id || '')
  const [targetAudienceTag, setTargetAudienceTag] = useState('high_school')
  const [batchSize, setBatchSize] = useState(50)
  const [error, setError] = useState<string | null>(null)

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
      setError('Batch size must be between 1 and 500 recipients per ESP limit.')
      return
    }

    store.addCampaign({
      name: name.trim(),
      template_id: templateId,
      target_audience_tag: targetAudienceTag === 'all' ? undefined : targetAudienceTag,
      batch_size: batchSize,
      created_by: store.getCurrentUser().id,
    })

    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Create Outreach Campaign
          </h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-900">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Campaign Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q4 District Leadership Outreach"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Select Email Template *
            </label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            >
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Target Audience Tag
              </label>
              <select
                value={targetAudienceTag}
                onChange={(e) => setTargetAudienceTag(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="all">All Audiences</option>
                <option value="high_school">high_school</option>
                <option value="district_admin">district_admin</option>
                <option value="educators">educators</option>
                <option value="nonprofit">nonprofit</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Batch Size (1-500)
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={batchSize}
                onChange={(e) => setBatchSize(parseInt(e.target.value) || 50)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            <strong>Approval Notice:</strong> Campaigns are initialized in <code>draft</code> status. An approval by a Marketing Lead or Administrator is required before emails can be dispatched.
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm"
            >
              Create Campaign
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
