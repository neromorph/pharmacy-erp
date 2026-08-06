# 07 — Design: FHIR MedicationDispense payload mapping

Type: grilling
Blocked by: 06
Status: open

## Question

How does a pharmacy-erp PAID sale translate into a SATUSEHAT FHIR `MedicationDispense` payload?

This ticket resolves:

1. **Field mapping**: for each required FHIR field, what pharmacy-erp source field provides it?
   - `subject`: `Patient` reference using `patients.ihs_number`
   - `performer`: `Practitioner` reference — from what? (doctor IHS number from API research)
   - `medication`: KFA code from `products.kfa_code` (new field, added by KFA ticket)
   - `quantity`: `sale_items.qty_base` in base unit
   - `whenHandedOver`: `sales.paid_at`
   - `authorizingPrescription`: prescription reference — how expressed?
2. **Racikan handling**: how are compound (racikan) `sale_items` submitted? One `MedicationDispense` per child ingredient, or one per parent?
3. **BPJS vs RESEP differentiation**: does the payload differ between `sale_type = 'RESEP'` and `sale_type = 'BPJS'`? Does BPJS number appear in the payload?
4. **Organization reference**: how is `performer.actor` (Apotek org) expressed — using `org_id` from tenant settings?
5. **Submission unit**: single `MedicationDispense` per sale item, or a FHIR `Bundle` per sale?

## Answer

<!-- append on resolution -->
