'use client'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/submit-button'

interface VoidSaleDialogProps {
  saleId: string
  action: (formData: FormData) => void | Promise<void>
}

// Voiding a PAID sale restores batch stock and cannot be undone — confirm first.
export function VoidSaleDialog({ saleId, action }: VoidSaleDialogProps) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="destructive" />}>Void Sale</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void this sale?</DialogTitle>
          <DialogDescription>
            Stock returns to its FEFO batches. The sale stays in the record as VOID.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton={false}>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <form action={action}>
            <input type="hidden" name="sale_id" value={saleId} />
            <SubmitButton variant="destructive">Void sale</SubmitButton>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
