'use client'

import { postPayout } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

const paymentMethods = ['CASH', 'TRANSFER', 'CARD', 'QRIS']

interface PayoutDialogProps {
  payableId: string
  remainingAmount: number
}

// One payout form per payable row. Keeps the postPayout server action
// contract: accounts_payable_id, amount, method, notes.
export function PayoutDialog({ payableId, remainingAmount }: PayoutDialogProps) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Pay</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payout</DialogTitle>
          <DialogDescription>
            Remaining balance: Rp {remainingAmount.toFixed(2)}. Unapplied supplier credit is applied first.
          </DialogDescription>
        </DialogHeader>
        <form action={postPayout} className="grid gap-3">
          <input type="hidden" name="accounts_payable_id" value={payableId} />
          <div className="grid gap-1.5">
            <Label htmlFor={`amount-${payableId}`}>Amount</Label>
            <Input
              id={`amount-${payableId}`}
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              max={remainingAmount}
              required
              placeholder="Amount"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`method-${payableId}`}>Method</Label>
            <select
              id={`method-${payableId}`}
              name="method"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {paymentMethods.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`notes-${payableId}`}>Notes</Label>
            <Input id={`notes-${payableId}`} name="notes" placeholder="Notes" />
          </div>
          <Button type="submit" className="mt-1 justify-self-end">Pay</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
