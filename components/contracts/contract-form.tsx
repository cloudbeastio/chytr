'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronLeft } from 'lucide-react'
import type { Contract, ContractStatus, ContractType } from '@/lib/database.types'

const STATUS_OPTIONS: { value: ContractStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'closed', label: 'Closed' },
]

const TYPE_OPTIONS: { value: ContractType; label: string }[] = [
  { value: 'one_off', label: 'One-off' },
  { value: 'master', label: 'Master' },
  { value: 'retainer', label: 'Retainer' },
]

interface ContractFormProps {
  contract?: Contract | null
  isEdit: boolean
}

export function ContractForm({ contract, isEdit }: ContractFormProps) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<ContractType>('one_off')
  const [status, setStatus] = useState<ContractStatus>('draft')
  const [accountName, setAccountName] = useState('')
  const [accountContact, setAccountContact] = useState('')
  const [accountEmail, setAccountEmail] = useState('')
  const [accountPhone, setAccountPhone] = useState('')
  const [budgetLimit, setBudgetLimit] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (contract) {
      setName(contract.name ?? '')
      setDescription(contract.description ?? '')
      setType(contract.type)
      setStatus(contract.status)
      setAccountName(contract.account_name ?? '')
      setAccountContact(contract.account_contact ?? '')
      setAccountEmail(contract.account_email ?? '')
      setAccountPhone(contract.account_phone ?? '')
      setBudgetLimit(contract.budget_limit != null ? String(contract.budget_limit) : '')
      setIsDefault(contract.is_default ?? false)
    }
  }, [contract])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        type,
        status,
        account_name: accountName.trim() || null,
        account_contact: accountContact.trim() || null,
        account_email: accountEmail.trim() || null,
        account_phone: accountPhone.trim() || null,
        budget_limit: budgetLimit ? parseFloat(budgetLimit) : null,
        is_default: isDefault,
      }
      const url = isEdit && contract ? `/api/contracts/${contract.id}` : '/api/contracts'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Request failed')
        return
      }
      router.push(`/contracts/${data.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" asChild>
          <Link href={isEdit && contract ? `/contracts/${contract.id}` : '/contracts'}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h2 className="text-lg font-semibold">{isEdit ? 'Edit contract' : 'New contract'}</h2>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Contract name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as ContractType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as ContractStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-muted-foreground">Account</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="account_name" className="text-xs">Account name</Label>
            <Input
              id="account_name"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Account name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account_contact" className="text-xs">Contact</Label>
            <Input
              id="account_contact"
              value={accountContact}
              onChange={(e) => setAccountContact(e.target.value)}
              placeholder="Contact name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account_email" className="text-xs">Email</Label>
            <Input
              id="account_email"
              type="email"
              value={accountEmail}
              onChange={(e) => setAccountEmail(e.target.value)}
              placeholder="email@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account_phone" className="text-xs">Phone</Label>
            <Input
              id="account_phone"
              value={accountPhone}
              onChange={(e) => setAccountPhone(e.target.value)}
              placeholder="Phone"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="budget_limit">Budget limit</Label>
        <Input
          id="budget_limit"
          type="number"
          step="0.01"
          min="0"
          value={budgetLimit}
          onChange={(e) => setBudgetLimit(e.target.value)}
          placeholder="Optional cap"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_default"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="rounded border-border"
        />
        <Label htmlFor="is_default" className="font-normal text-sm">Use as default contract for new work orders</Label>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving || !name.trim()}>
          {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href={isEdit && contract ? `/contracts/${contract.id}` : '/contracts'}>Cancel</Link>
        </Button>
      </div>
    </form>
  )
}
