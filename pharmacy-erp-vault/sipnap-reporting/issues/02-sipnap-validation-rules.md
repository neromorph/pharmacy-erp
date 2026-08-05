# 02 SIPNAP validation rules

Type: grilling
Status: resolved
Blocked by: 01

## Answer

Hard block export. `Ready` means all required fields exist. `Missing Data` means any required field is absent.

Block when any Narkotika/Psikotropika row in the month misses one of these fields:
- Doctor Name
- Doctor SIP
- Patient Name
- Patient Address

Use the validation table to show broken transaction invoice numbers and quick-links to fix them. Do not let APJ download export until zero missing rows remain.

## Question

What rows must show `Ready` vs `Missing Data` in SIPNAP v1?

Need answer for:
1. Required patient fields
2. Required doctor fields
3. Required sale fields
4. Required product fields
5. Which missing values block export
