import {YBASE} from './letters.js';

export const PLAN = [
  {t:"あ row and か row", f:['a','k'], tasks:[
    "Tap each new character. Read the memory hook and say the sound out loud. (10 min)",
    "Write each one in Write. It checks the order and direction of every stroke. (10 min)",
    "Drill “Today” in Read mode. Repeat until you score 90% or more. (10 min)"]},
  {t:"さ row and た row", f:['s','t'], tasks:[
    "Warm up: drill “Learned so far” in Read mode. (5 min)",
    "Learn the 10 new ones. Three break the pattern: し is shi, ち is chi, つ is tsu. (10 min)",
    "Write each new one 5 times. (5 min)",
    "Drill “Today” to 90% or more. (10 min)"]},
  {t:"な row and は row", f:['n','h'], tasks:[
    "Warm up: drill “Learned so far”. (5 min)",
    "Learn the 10 new ones. ふ is fu, blown softly with the lips, no teeth. (10 min)",
    "Write each new one 5 times. (5 min)",
    "Drill “Today” to 90% or more. (10 min)"]},
  {t:"ま row and や row", f:['m','y'], tasks:[
    "Warm up: drill “Learned so far”. (5 min)",
    "Learn the 8 new ones. The や row has only three: や, ゆ, よ. (10 min)",
    "Write each new one 5 times. (5 min)",
    "Drill “Today” to 90% or more. (10 min)"]},
  {t:"ら row, わ, を, ん", f:['r','w','nn'], tasks:[
    "Warm up: drill “Learned so far”. (5 min)",
    "Learn the 8 new ones. Japanese r is a light tap of the tongue, between r, l and d. を is read o. (10 min)",
    "Write each new one 5 times. (5 min)",
    "Drill “Today” to 90% or more. (10 min)"]},
  {t:"Review all 46", f:[], pool:'a46', tasks:[
    "Drill “Look-alikes” in Read mode. (10 min)",
    "Drill “Weak ones”. (10 min)",
    "Write every character you missed today 5 times. (10 min)"]},
  {t:"Checkpoint: all 46", f:[], pool:'a46', tasks:[
    "Drill “All 46”, length All, in Read mode. Target: 90% or more on first try. (10 min)",
    "On paper, write all 46 from memory in chart order, then check them against Letters. (15 min)",
    "Drill “Weak ones”. (5 min)"]},
  {t:"が ざ だ ば ぱ rows: 25 more", f:['g','z','d','b','p'], tasks:[
    "Learn the rule instead of 25 new shapes: ゛ turns k→g, s→z, t→d, h→b, and ゜ turns h→p. (5 min)",
    "Drill “Today” in Read mode to 90% or more. (15 min)",
    "Read the “With ゛ and ゜” words in Words out loud. (10 min)"]},
  {t:"Small ゃ ゅ ょ: 33 combinations", f:YBASE.map(b => 'y-'+b), tasks:[
    "Learn the rule: an i-sound plus a small ゃ, ゅ or ょ is one beat. き + ゃ = kya. (5 min)",
    "Drill “Today” in Read mode to 90% or more. (15 min)",
    "Read the small ゃゅょ words out loud. (10 min)"]},
  {t:"Small っ, long vowels, は へ を", f:[], pool:'all', tasks:[
    "Read the rules box at the top of Words. (5 min)",
    "Read the small っ and long-vowel words out loud, then check. (15 min)",
    "Drill “Everything” for 20 questions. (10 min)"]},
  {t:"Reading words", f:[], pool:'all', tasks:[
    "Read every word list in Words with romaji hidden. Say each word before you reveal it. (20 min)",
    "Drill “Weak ones”. (10 min)"]},
  {t:"Reading sentences", f:[], pool:'all', tasks:[
    "Read the 12 sentences with romaji hidden. (15 min)",
    "Copy 3 sentences by hand, then write them again from memory. (10 min)",
    "Drill “Weak ones”. (5 min)"]},
  {t:"Speed", f:[], pool:'all', tasks:[
    "Drill “All 46” in Listen mode. (10 min)",
    "Drill “Everything” in Read mode. Target: average answer under 2 seconds. (15 min)",
    "Re-read the sentences. (5 min)"]},
  {t:"Final test", f:[], pool:'all', tasks:[
    "Drill “Everything”, length All: 104 questions in Read mode. Target: 95% or more on first try. (15 min)",
    "Write all 46 from memory on paper. (10 min)",
    "Drill “Weak ones”. Tomorrow, start katakana with the same method. (5 min)"]}
];
export const WORDS = [
  {id:'w1', title:"Only the 46 basics", from:6, items:[
    ["いぬ","inu","dog"],["ねこ","neko","cat"],["さかな","sakana","fish"],["とり","tori","bird"],["あめ","ame","rain; candy"],["やま","yama","mountain"],["かわ","kawa","river"],["うみ","umi","sea"],["はな","hana","flower; nose"],["みみ","mimi","ear"],["くち","kuchi","mouth"],["て","te","hand"],["あし","ashi","foot, leg"],["あさ","asa","morning"],["よる","yoru","night"],["いえ","ie","house"],["ほん","hon","book"],["かさ","kasa","umbrella"],["えき","eki","station"],["つくえ","tsukue","desk"],["いす","isu","chair"],["くつ","kutsu","shoes"],["ひと","hito","person"],["なまえ","namae","name"],["わたし","watashi","I, me"],["あなた","anata","you"],["これ","kore","this"],["それ","sore","that"],["みせ","mise","shop"],["しお","shio","salt"],["あか","aka","red"],["しろ","shiro","white"],["くろ","kuro","black"],["はる","haru","spring"],["なつ","natsu","summer"],["あき","aki","autumn"],["ふゆ","fuyu","winter"]]},
  {id:'w2', title:"With ゛ and ゜", from:8, items:[
    ["たまご","tamago","egg"],["ごはん","gohan","cooked rice; a meal"],["みず","mizu","water"],["かぜ","kaze","wind; a cold"],["かばん","kaban","bag"],["かぎ","kagi","key"],["どこ","doko","where"],["だれ","dare","who"],["ひだり","hidari","left"],["みぎ","migi","right"],["えんぴつ","enpitsu","pencil"],["てがみ","tegami","letter"],["げんき","genki","well, healthy"],["にほんご","nihongo","Japanese (language)"],["さんぽ","sanpo","a walk"],["ぜんぶ","zenbu","all of it"],["でんき","denki","electricity; the light"],["ばんごはん","bangohan","dinner"],["あぶない","abunai","dangerous"],["しずか","shizuka","quiet"],["ください","kudasai","please (give me)"]]},
  {id:'w3', title:"With small ゃ ゅ ょ", from:9, items:[
    ["でんしゃ","densha","train"],["おちゃ","ocha","green tea"],["しゃしん","shashin","photo"],["じしょ","jisho","dictionary"],["ひゃく","hyaku","hundred"],["ちゃいろ","chairo","brown"],["としょかん","toshokan","library"],["かいしゃ","kaisha","company"],["いしゃ","isha","doctor"],["おもちゃ","omocha","toy"],["しゅみ","shumi","hobby"],["きゃく","kyaku","guest, customer"]]},
  {id:'w4', title:"With small っ and long vowels", from:10, items:[
    ["きって","kitte","stamp"],["きっぷ","kippu","ticket"],["ざっし","zasshi","magazine"],["いっしょ","issho","together"],["ちょっと","chotto","a little"],["がっこう","gakkō","school"],["おかあさん","okāsan","mother"],["おとうさん","otōsan","father"],["おにいさん","oniisan","older brother"],["おねえさん","onēsan","older sister"],["せんせい","sensei","teacher"],["とけい","tokei","clock, watch"],["えいが","eiga","film"],["おおきい","ōkii","big"],["ちいさい","chiisai","small"],["きょう","kyō","today"],["ありがとう","arigatō","thank you"],["くうこう","kūkō","airport"],["ぎゅうにゅう","gyūnyū","milk"],["びょういん","byōin","hospital"],["りょこう","ryokō","trip"],["こんにちは","konnichiwa","hello"],["こんばんは","konbanwa","good evening"]]}
];
export const SENTENCES = [
  ["これは ほんです。","Kore wa hon desu.","This is a book."],
  ["ねこが すきです。","Neko ga suki desu.","I like cats."],
  ["えきは どこですか。","Eki wa doko desu ka.","Where is the station?"],
  ["みずを ください。","Mizu o kudasai.","Water, please."],
  ["あしたは あめです。","Ashita wa ame desu.","It will rain tomorrow."],
  ["まいにち おちゃを のみます。","Mainichi ocha o nomimasu.","I drink tea every day."],
  ["でんしゃで かいしゃへ いきます。","Densha de kaisha e ikimasu.","I go to the office by train."],
  ["これは いくらですか。","Kore wa ikura desu ka.","How much is this?"],
  ["きょうは いい てんきですね。","Kyō wa ii tenki desu ne.","Nice weather today, isn't it?"],
  ["にほんごを べんきょうして います。","Nihongo o benkyō shite imasu.","I am studying Japanese."],
  ["ちょっと まって ください。","Chotto matte kudasai.","Please wait a moment."],
  ["ありがとう ございます。","Arigatō gozaimasu.","Thank you very much."]
];
export const EXAMPLES = {"あ":["あめ","ame","rain","مطر"],"い":["いぬ","inu","dog","كلب"],"う":["うみ","umi","sea","بحر"],"え":["えき","eki","station","محطة"],"お":["おちゃ","ocha","green tea","شاي أخضر"],"か":["かさ","kasa","umbrella","مظلّة"],"き":["きって","kitte","stamp","طابع بريد"],"く":["くち","kuchi","mouth","فم"],"け":["けいたい","keitai","mobile phone","هاتف محمول"],"こ":["こども","kodomo","child","طفل"],"さ":["さかな","sakana","fish","سمكة"],"し":["しお","shio","salt","ملح"],"す":["すし","sushi","sushi","سوشي"],"せ":["せんせい","sensei","teacher","معلّم"],"そ":["そら","sora","sky","سماء"],"た":["たまご","tamago","egg","بيضة"],"ち":["ちず","chizu","map","خريطة"],"つ":["つくえ","tsukue","desk","مكتب"],"て":["てがみ","tegami","letter (mail)","رسالة"],"と":["とり","tori","bird","طائر"],"な":["なつ","natsu","summer","صيف"],"に":["にく","niku","meat","لحم"],"ぬ":["ぬいぐるみ","nuigurumi","stuffed toy","دمية محشوّة"],"ね":["ねこ","neko","cat","قطة"],"の":["のみもの","nomimono","drink","مشروب"],"は":["はな","hana","flower","زهرة"],"ひ":["ひと","hito","person","شخص"],"ふ":["ふゆ","fuyu","winter","شتاء"],"へ":["へや","heya","room","غرفة"],"ほ":["ほん","hon","book","كتاب"],"ま":["まち","machi","town","مدينة"],"み":["みず","mizu","water","ماء"],"む":["むし","mushi","insect","حشرة"],"め":["めがね","megane","glasses","نظّارة"],"も":["もも","momo","peach","خوخ"],"や":["やま","yama","mountain","جبل"],"ゆ":["ゆき","yuki","snow","ثلج"],"よ":["よる","yoru","night","ليل"],"ら":["らいねん","rainen","next year","السنة القادمة"],"り":["りんご","ringo","apple","تفاحة"],"る":["るす","rusu","away from home","غير موجود في البيت"],"れ":["れいぞうこ","reizōko","fridge","ثلاجة"],"ろ":["ろうそく","rōsoku","candle","شمعة"],"わ":["わたし","watashi","I, me","أنا"],"を":["みずを のむ","mizu o nomu","drink water","يشرب الماء"],"ん":["ほん","hon","book","كتاب"],"が":["がっこう","gakkō","school","مدرسة"],"ぎ":["ぎんこう","ginkō","bank","بنك"],"ぐ":["ぐあい","guai","how you feel","الحال، الصحة"],"げ":["げんき","genki","well, healthy","بخير"],"ご":["ごはん","gohan","rice, meal","أرز؛ وجبة"],"ざ":["ざっし","zasshi","magazine","مجلّة"],"じ":["じしょ","jisho","dictionary","قاموس"],"ず":["ずっと","zutto","all the time","طوال الوقت"],"ぜ":["ぜんぶ","zenbu","all of it","كل شيء"],"ぞ":["ぞう","zō","elephant","فيل"],"だ":["だれ","dare","who","مَن"],"ぢ":["はなぢ","hanaji","nosebleed","رُعاف"],"づ":["つづく","tsuzuku","to continue","يستمرّ"],"で":["でんしゃ","densha","train","قطار"],"ど":["どこ","doko","where","أين"],"ば":["ばんごはん","bangohan","dinner","عشاء"],"び":["びじゅつかん","bijutsukan","art museum","متحف فنون"],"ぶ":["ぶんか","bunka","culture","ثقافة"],"べ":["べんきょう","benkyō","study","دراسة"],"ぼ":["ぼうし","bōshi","hat","قبّعة"],"ぱ":["いっぱい","ippai","full","ممتلئ"],"ぴ":["えんぴつ","enpitsu","pencil","قلم رصاص"],"ぷ":["きっぷ","kippu","ticket","تذكرة"],"ぺ":["ぺこぺこ","pekopeko","very hungry","جائع جداً"],"ぽ":["さんぽ","sanpo","a walk","نزهة"],"きゃ":["きゃく","kyaku","guest","ضيف"],"きゅ":["きゅう","kyū","nine","تسعة"],"きょ":["きょう","kyō","today","اليوم"],"しゃ":["しゃしん","shashin","photo","صورة"],"しゅ":["しゅみ","shumi","hobby","هواية"],"しょ":["しょくじ","shokuji","meal","وجبة"],"ちゃ":["おちゃ","ocha","green tea","شاي أخضر"],"ちゅ":["ちゅうい","chūi","attention","انتباه"],"ちょ":["ちょっと","chotto","a little","قليلاً"],"にゃ":["にゃあ","nyā","meow","مواء القطة"],"にゅ":["ぎゅうにゅう","gyūnyū","milk","حليب"],"にょ":["にょろにょろ","nyoronyoro","wriggling","يتلوّى"],"ひゃ":["ひゃく","hyaku","hundred","مئة"],"ひゅ":["ひゅうひゅう","hyūhyū","whistling wind","صفير الريح"],"ひょ":["ひょう","hyō","hail","بَرَد"],"みゃ":["みゃく","myaku","pulse","نبض"],"みょ":["みょうじ","myōji","family name","اسم العائلة"],"りゃ":["りゃくご","ryakugo","abbreviation","اختصار"],"りゅ":["りゅう","ryū","dragon","تنّين"],"りょ":["りょこう","ryokō","trip","رحلة"],"ぎゃ":["ぎゃく","gyaku","opposite","عكس"],"ぎゅ":["ぎゅうにゅう","gyūnyū","milk","حليب"],"ぎょ":["きんぎょ","kingyo","goldfish","سمكة ذهبية"],"じゃ":["じゃんけん","janken","rock, paper, scissors","حجرة ورقة مقص"],"じゅ":["じゅぎょう","jugyō","class, lesson","حصة دراسية"],"じょ":["じょうず","jōzu","skilful","ماهر"],"びゃ":["さんびゃく","sanbyaku","three hundred","ثلاثمئة"],"びゅ":["びゅうびゅう","byūbyū","howling wind","عصف الريح"],"びょ":["びょういん","byōin","hospital","مستشفى"],"ぴゃ":["はっぴゃく","happyaku","eight hundred","ثمانمئة"],"ぴゅ":["ぴゅうぴゅう","pyūpyū","whistling","صوت صفير"],"ぴょ":["ぴょんぴょん","pyonpyon","hopping","قفزاً"]};
export const REVIEW_EN = {t: "Review day", tasks: [
  "Drill “Learned so far” in Read mode. (10 min)",
  "Drill “Weak ones”. (10 min)",
  "Write each letter you missed 3 times, then say it out loud. (10 min)"]};
