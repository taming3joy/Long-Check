# Manual Test Cases

Use these messages in LINE or a webhook simulator.

## High Risk

ด่วน! รับแอร์ดรอปภายใน 10 นาที คลิก bit.ly/claim แล้ว connect wallet จากนั้น approve token เพื่อรับรางวัล

Expected: High Risk with urgency, suspicious link, wallet action, and reward flagged.

## Medium Risk

มี Discord DM บอกว่าได้ free NFT จาก unknown source ให้กดลิงก์แปลกเพื่อ claim

Expected: Medium Risk with suspicious link or strange source flagged.

## Low Risk

ควรตรวจสอบจากแหล่งทางการและ official website ก่อนทำรายการทุกครั้ง

Expected: Low Risk with official source verification noted.

## Non-Text Message

Send an image, sticker, or file.

Expected: bot replies that the MVP supports text only.
