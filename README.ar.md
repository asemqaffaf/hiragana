<table width="100%">
  <tr>
    <td align="center" width="33%">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;🇯🇵 <a href="README.md"><b>日本語</b></a>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td>
    <td align="center" width="33%">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;🇬🇧 <a href="README.en.md"><b>English</b></a>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td>
    <td align="center" width="33%">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;● 🇸🇦 <b>العربية</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td>
  </tr>
</table>

# ひらがな Hiragana in 14 days

تعلم جميع حروف الهيراغانا الـ 104 باللغتين العربية والإنجليزية. يتضمن خطة تعليمية لمدة 14 يوماً، وتدريباً على الرسم خطوة بخطوة، وتمارين، وتدريبات قراءة مع الصوت.

تطوير: عاصم قفاف (Asem Qaffaf)  
الموقع: https://asemqaffaf.github.io/hiragana/

## تطبيق متكامل بدون خادم وبدون قاعدة بيانات (Google Apps Script + Google Drive)

يحفظ التطبيق تقدم الطلاب عبر مختلف الأجهزة دون الحاجة إلى خادم خلفي (Backend) أو قاعدة بيانات، باستخدام حساب Google مجاني فقط:

- **موقع ثابت (Static):** مستضاف على GitHub Pages باستخدام HTML وCSS ووحدات JavaScript نقية، بدون أي أدوات بناء أو أطر عمل.
- **Google Apps Script كبديل للخادم:** كود نصي بسيط ([`scripts/google-apps-script.gs`](scripts/google-apps-script.gs)) يعمل على بنية Google التحتية ضمن حساب المعلم، ويتولى معالجة طلبات الحفظ والقراءة والحذف وإعادة تعيين كلمة المرور.
- **Google Drive كبديل لقاعدة البيانات:** تُحفظ بيانات جميع الطلاب في ملف خاص واحد `students.json` داخل Google Drive الخاص بالمعلم (بصلاحية **خاص / Restricted**). ويستخدم Apps Script ميزة القفل (`LockService`) أثناء الكتابة لمنع تعارض الحفظ المتزامن بين الطلاب.
- **العمل دون اتصال أولاً (Offline-first):** تُحفظ التغييرات في `localStorage` أولاً ثم تتم المزامنة في الخلفية عند توفر الاتصال بالإنترنت.
- **أمان كلمات المرور:** يتم تجزئة كلمات المرور في المتصفح باستخدام PBKDF2 (بـ 310,000 تكرار)، ولا يُخزن في Google Drive سوى تجزئة SHA-256 دون حفظ كلمة المرور الأصلية مطلقاً.

### الإعداد

1. أنشئ ملفاً خاصاً باسم `students.json` محتواه `{}` في Google Drive (مضبوط على **خاص / Restricted**)، ثم ضع معرف الملف في [`scripts/google-apps-script.gs`](scripts/google-apps-script.gs).
2. الصق الكود في [script.google.com](https://script.google.com/)، وأضف `TEACHER_KEY` في **خصائص المشروع (Script Properties)**، ثم انشر كتطبيق ويب (**Web app**) (*التنفيذ بصفتي: أنا*, *إمكانية الوصول: أي شخص*).
3. أضف رابط `/exec` كـ secret باسم `SYNC_URL` في إعدادات GitHub، واضبط نشر **Pages** ليكون عبر **GitHub Actions**.

## واجهة مستخدم بنمط iOS 26 مع تجربة استخدام رائعة

- **تصميم الزجاج السائل (Liquid Glass):** أشرطة زجاجية شبه شفافة، وشريط تنقل عائم مزود بعدسة مكبرة قابلة للسحب، وبطاقات تنزلق للإغلاق.
- **تفاعل سلس:** حركة فيزيائية مرنة (Spring motion)، ورسم تفاعلي بالقلم على لوحة الكتابة، وتشغيل فوري للصوت.
- **تخصيص كامل ودعم اللغات:** 7 سمات مظهرية فاتحة وداكنة، ووضع خاص بالأطفال (Child Mode)، ودعم كامل للغتين الإنجليزية والعربية (اتجاه من اليمين لليسار RTL).

## التشغيل محلياً

```sh
python3 -m http.server 8000     # http://127.0.0.1:8000/
```

## المصادر والاعتمادات

- بيانات رسم الحروف: [KanjiVG](https://kanjivg.tagaini.net) ([CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/))
- الصوت: VOICEVOX:No.7 ([VOICEVOX](https://voicevox.hiroshiba.jp/))
- الخطوط: Klee One, Zen Kaku Gothic New, IBM Plex Sans Arabic (Google Fonts)
