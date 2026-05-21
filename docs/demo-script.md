# Demo Script

## 1. High Risk

Paste:

```text
ด่วน! รับแอร์ดรอปภายใน 10 นาที คลิก bit.ly/claim แล้ว connect wallet จากนั้น approve token เพื่อรับรางวัล
```

Expected result: Long-Check replies `High Risk` and warns about urgency, suspicious link, wallet connection, and token approval.

## 2. Medium Risk

Paste:

```text
มี Discord DM บอกว่าได้ free NFT จาก unknown source ให้กดลิงก์แปลกเพื่อ claim
```

Expected result: Long-Check replies `Medium Risk` and suggests checking official sources before clicking.

## 3. Low Risk

Paste:

```text
ควรตรวจสอบจากแหล่งทางการและ official website ก่อนทำรายการทุกครั้ง
```

Expected result: Long-Check replies `Low Risk` and reminds the user to continue checking domains and wallet prompts.
