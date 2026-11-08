# KJST Portal

หน้าเว็บรวมลิงก์ระบบสารสนเทศ โรงเรียนกาญจนาภิเษกวิทยาลัย สุราษฎร์ธานี
พร้อมปฏิทินภาคเรียน 2/2569 และตารางสอนครูประจำสัปดาห์จากระบบจัดสอนแทน

## โครงสร้าง
| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | หน้าเว็บที่ GitHub Pages เผยแพร่ (ไฟล์เดียว ฝังโลโก้และข้อมูลไว้แล้ว) |
| `src/index.template.html` | ต้นฉบับสำหรับแก้ไข (ลิงก์ระบบอยู่ในตัวแปร `DAILY` และ `GROUPS`) |
| `data/timetable.json` | ข้อมูลตารางสอน + สอนแทน ชุดล่าสุด (snapshot) |
| `apps-script/Code.gs` | API ดึงข้อมูลสดจากไฟล์ "แบบจัดสอนแทน 2569" |
| `scripts/build.py` | รวม template + โลโก้ + ข้อมูล → `index.html` |

## แก้ลิงก์แล้ว build ใหม่
```
python scripts/build.py
```

## เปิดข้อมูลสด (ไม่บังคับ)
1. สร้างโปรเจกต์ Apps Script วาง `apps-script/Code.gs`
2. Deploy เป็น Web app: Execute as **Me**, Who has access **Anyone**
3. ใส่ URL `/exec` ใน `config/api_url.txt` แล้วรัน `python scripts/build.py`

API ไม่ส่งสาเหตุการลาออกไป (PDPA) ส่งเฉพาะวัน คาบ วิชา ห้อง ครูประจำวิชา และครูสอนแทน
