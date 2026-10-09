/* Admin account. Password is stored only as a PBKDF2-SHA256 hash (150k iterations), never as plain text.
   Change it after login on the home page (Change password). */
const DEFAULT_ADMIN = { u: 'admin', salt: '961469ab3b828cf3ee9cf2ee5856fdd1', hash: 'c465932c431475d0c34b89170796ddff7cc065ce21ef97d3694efe60e677db40' };

/* ============================================================
   PadelLive — მონაცემები
   აქ შეგიძლია ჩაასწორო რეიტინგი, ჩოგნები და ივენთები.
   ============================================================ */

/* რეიტინგი — სადემონსტრაციო ქულები. რედაქტირება შეიძლება საიტზეც. */
const RANKS_DEFAULT = {
  men: [
    { n: 'Arturo Coello',        c: 'ESP', p: 14200 },
    { n: 'Agustín Tapia',        c: 'ARG', p: 14050 },
    { n: 'Alejandro Galán',      c: 'ESP', p: 12900 },
    { n: 'Federico Chingotto',   c: 'ARG', p: 12600 },
    { n: 'Juan Lebrón',          c: 'ESP', p: 11800 },
    { n: 'Martín Di Nenno',      c: 'ARG', p: 10300 },
    { n: 'Franco Stupaczuk',     c: 'ARG', p: 9400 },
    { n: 'Francisco Navarro',    c: 'ESP', p: 8700 },
    { n: 'Miguel Yanguas',       c: 'ESP', p: 7900 },
    { n: 'Sanyo Gutiérrez',      c: 'ARG', p: 7300 },
    { n: 'Coki Nieto',           c: 'ESP', p: 6600 },
    { n: 'Jon Sanz',             c: 'ESP', p: 5800 }
  ],
  women: [
    { n: 'Ariana Sánchez',       c: 'ESP', p: 12800 },
    { n: 'Paula Josemaría',      c: 'ESP', p: 12700 },
    { n: 'Gemma Triay',          c: 'ESP', p: 11900 },
    { n: 'Beatriz González',     c: 'ESP', p: 11200 },
    { n: 'Delfina Brea',         c: 'ARG', p: 9800 },
    { n: 'Claudia Fernández',    c: 'ESP', p: 9200 },
    { n: 'Marta Ortega',         c: 'ESP', p: 8600 },
    { n: 'Tamara Icardo',        c: 'ESP', p: 7700 },
    { n: 'Lucía Sainz',          c: 'ESP', p: 6900 },
    { n: 'Aranzazu Osoro',       c: 'ESP', p: 6100 },
    { n: 'Patricia Llaguno',     c: 'ESP', p: 5600 },
    { n: 'Jessica Castelló',     c: 'ESP', p: 5100 }
  ]
};

/* ტურნირების კალენდარი (დემო): დღეები დღევანდელი თარიღიდან. */
const EVENTS = [
  { off: 6,  t: 'კლუბის ღია ტურნირი',       place: 'თბილისი',   lvl: 'დამწყებები / საშუალო' },
  { off: 13, t: 'Mixed Doubles Cup',          place: 'ბათუმი',    lvl: 'შერეული წყვილები' },
  { off: 27, t: 'საქართველოს ჩემპიონატი',     place: 'თბილისი',   lvl: 'მოწინავე' },
  { off: 41, t: 'Padel Night — 3 საათიანი მარათონი', place: 'ქუთაისი', lvl: 'ყველა დონე' }
];

/* წესები ერთ ნახვაზე */
const RULES = [
  { i: '📐', t: 'კორტი 20×10 მ', d: 'მინის და ბადისებრი კედლებით. ბურთი კედლიდან უკან ბრუნდება და თამაშში რჩება.' },
  { i: '👥', t: 'წყვილები', d: 'ყოველთვის 2 ორის წინააღმდეგ. ჩოგანი ხვრელებიანია, ბურთი — ტენისის მსგავსი, ოდნავ დაბალი წნევით.' },
  { i: '🔢', t: 'ქულა', d: '15 → 30 → 40 → გეიმი. 40-40-ზე „ოქროს ქულა“: შემდეგი ქულა იგებს გეიმს.' },
  { i: '🤾', t: 'სერვა', d: 'ქვემოდან, წელის დონეზე ქვემოთ დარტყმა; ბურთი ჯერ მიწას უნდა შეეხოს. სერვაზე 2 ცდა გაქვს.' },
  { i: '🧱', t: 'კედლები', d: 'ბურთი მოწინააღმდეგის მხარეს ჯერ მიწას უნდა შეეხოს, მერე — კედელს. შენს მხარეს კედლიდან დაბრუნებულ ბურთს ხტომის შემდეგ ურტყამ.' },
  { i: '🏁', t: 'სეტი და მატჩი', d: 'სეტი — 6 გეიმამდე (2 გეიმის სხვაობით), 6-6-ზე ტაიბრეიკი 7 ქულამდე. მატჩი — 2 მოგებულ სეტამდე.' }
];

const GLOSSARY = [
  { t: 'ბანდეხა (Bandeja)', d: 'თავზე მაღლა დარტყმა ბრტყელი, კონტროლირებადი ტრაექტორიით — ბადესთან პოზიციის შესანარჩუნებლად.' },
  { t: 'ვიბორა (Víbora)', d: 'ბანდეხის უფრო აგრესიული ვარიანტი: გვერდითი ჭრით, ბურთი სწრაფად ეშვება და კედლიდან გვერდზე გადადის.' },
  { t: 'ბაჰადა (Bajada)', d: 'კედლიდან ამოსულ ბურთზე ძლიერი დარტყმა ქვემოთ — ძირითადი შეტევითი იარაღი.' },
  { t: 'ჩიკიტა (Chiquita)', d: 'რბილი, დაბალი დარტყმა ბადესთან მდგარი მოწინააღმდეგის ფეხებთან.' },
  { t: 'გლობო (Globo)', d: 'მაღალი ლობი, რომლითაც მოწინააღმდეგეს ბადიდან აშორებ და პოზიციას იბრუნებ.' },
  { t: 'სმეში x3 / x4', d: 'ისეთი სმეში, რომლის შემდეგაც ბურთი მოწინააღმდეგის კორტის გარეთ გადადის გვერდითი ან უკანა ბადის ზემოდან.' }
];

/* ჩოგნების ბაზა.
   shape: round | teardrop | diamond
   bal  : low | mid | high   (წონასწორობა — სახელურისკენ / შუაში / თავისკენ)
   hard : soft | medium | hard
   lvl  : 1 დამწყები · 2 საშუალო · 3 მოწინავე (მინიმალური რეკომენდებული დონე)
   price: 1 ეკონომიური · 2 საშუალო · 3 პრემიუმი
   მახასიათებლები დაახლოებითია — გადაამოწმე მწარმოებლის საიტზე.   */
const RACKETS = [
  { name: 'Kuikma PR 990 Control',  brand: 'Decathlon', shape: 'round',    bal: 'low',  w: 360, hard: 'soft',   lvl: 1, price: 1, note: 'ძალიან მეგობრული და იაფი ჩოგანი პირველი თვეებისთვის.' },
  { name: 'Bullpadel Pearl',        brand: 'Bullpadel', shape: 'round',    bal: 'low',  w: 355, hard: 'soft',   lvl: 1, price: 1, note: 'დიდი „sweet spot“, ბურთს ადვილად აკონტროლებ.' },
  { name: 'Adidas Drive 3.3',       brand: 'Adidas',    shape: 'round',    bal: 'low',  w: 360, hard: 'medium', lvl: 1, price: 1, note: 'გამძლე და პროგნოზირებადი, ამორტიზაცია კარგი აქვს.' },
  { name: 'Head Delta Pro',         brand: 'Head',      shape: 'round',    bal: 'low',  w: 360, hard: 'medium', lvl: 2, price: 2, note: 'სიზუსტე და კომფორტი ყველა დარტყმაზე.' },
  { name: 'Nox X-One Evo',          brand: 'Nox',       shape: 'round',    bal: 'low',  w: 355, hard: 'soft',   lvl: 1, price: 2, note: 'მსუბუქი, რბილი — იდაყვზე ნაზი.' },
  { name: 'Black Crown Piton',      brand: 'Black Crown', shape: 'round',  bal: 'low',  w: 360, hard: 'medium', lvl: 2, price: 2, note: 'კონტროლის კლასიკა, ძლიერი დაცვითი თამაშისთვის.' },
  { name: 'Adidas Adipower Light 3.3', brand: 'Adidas', shape: 'teardrop', bal: 'mid',  w: 345, hard: 'medium', lvl: 2, price: 2, note: 'მსუბუქი ვერსია — ძალა ტვირთის გარეშე.' },
  { name: 'Babolat Air Veron',      brand: 'Babolat',   shape: 'teardrop', bal: 'mid',  w: 345, hard: 'medium', lvl: 2, price: 2, note: 'მსუბუქი და მანევრირებადი, საუკეთესოა ქალებისა და მსუბუქი სტილისთვის.' },
  { name: 'Babolat Technical Vertuo', brand: 'Babolat', shape: 'teardrop', bal: 'mid',  w: 360, hard: 'medium', lvl: 2, price: 3, note: 'ბალანსი ძალასა და კონტროლს შორის.' },
  { name: 'Babolat Counter Viper',  brand: 'Babolat',   shape: 'teardrop', bal: 'mid',  w: 360, hard: 'medium', lvl: 2, price: 3, note: 'უნივერსალური, კარგი კონტრაშეტევებისთვის.' },
  { name: 'Nox ML10 Pro Cup',       brand: 'Nox',       shape: 'teardrop', bal: 'mid',  w: 365, hard: 'medium', lvl: 2, price: 2, note: 'ბალანსირებული ძალა და კონტროლი, პოპულარული ტურნირებზე.' },
  { name: 'Nox AT10 Genius 18K',    brand: 'Nox',       shape: 'teardrop', bal: 'mid',  w: 365, hard: 'medium', lvl: 3, price: 3, note: 'მოწინავე უნივერსალური ჩოგანი, ძალიან სტაბილური.' },
  { name: 'Adidas Adipower Multiweight', brand: 'Adidas', shape: 'teardrop', bal: 'mid', w: 365, hard: 'hard',  lvl: 3, price: 3, note: 'რეგულირებადი წონა, ძლიერი შეტევა.' },
  { name: 'Siux Diablo Revolution', brand: 'Siux',      shape: 'diamond',  bal: 'high', w: 365, hard: 'hard',   lvl: 3, price: 3, note: 'ძალა და სწრაფი ბურთი, ნაკლები პატიება შეცდომებისთვის.' },
  { name: 'StarVie Metheora Warrior', brand: 'StarVie', shape: 'diamond',  bal: 'high', w: 365, hard: 'hard',   lvl: 3, price: 3, note: 'ძალისხმევით თამაშობენ — სმეშისთვის შექმნილი.' },
  { name: 'Bullpadel Hack 03',      brand: 'Bullpadel', shape: 'diamond',  bal: 'high', w: 365, hard: 'hard',   lvl: 3, price: 3, note: 'აგრესიული შეტევითი ჩოგანი ნახევრად-პროფესიონალებისთვის.' },
  { name: 'Bullpadel Vertex 04',    brand: 'Bullpadel', shape: 'diamond',  bal: 'high', w: 365, hard: 'hard',   lvl: 3, price: 3, note: 'ძალის ფლაგმანი: ბადესთან და სმეშებზე ძლიერია.' },
  { name: 'Adidas Metalbone 3.3',   brand: 'Adidas',    shape: 'diamond',  bal: 'high', w: 365, hard: 'hard',   lvl: 3, price: 3, note: 'პროფესიონალი მოთამაშეების არჩევანი, მაქსიმალური ძალა.' },
  { name: 'Babolat Technical Viper', brand: 'Babolat',  shape: 'diamond',  bal: 'high', w: 365, hard: 'hard',   lvl: 3, price: 3, note: 'ფეთქებადი ძალა, ძლიერი მკლავისთვის.' },
  { name: 'Wilson Bela Pro',        brand: 'Wilson',    shape: 'diamond',  bal: 'high', w: 360, hard: 'hard',   lvl: 3, price: 3, note: 'ლეგენდარული შეტევითი ჩოგანი ძლიერი სმეშებისთვის.' }
];
