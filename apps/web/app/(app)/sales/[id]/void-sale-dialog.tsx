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

// Membatalkan penjualan PAID mengembalikan stok batch dan tidak dapat dibatalkan — konfirmasi dulu.
export function VoidSaleDialog({ saleId, action }: VoidSaleDialogProps) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="destructive" />}>Batalkan Transaksi</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Batalkan transaksi ini?</DialogTitle>
          <DialogDescription>
            Stok kembali ke batch FEFO-nya. Transaksi tetap tercatat sebagai VOID.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton={false}>
          <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
          <form action={action}>
            <input type="hidden" name="sale_id" value={saleId} />
            <SubmitButton variant="destructive">Batalkan transaksi</SubmitButton>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
