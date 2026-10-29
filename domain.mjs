// Shared, dependency-free rules. Stage 1 has no server or external requests.
export const SCHEMA_VERSION = 2;
// Explicit validation failures are safe to show; unexpected runtime errors are not.
export class ValidationError extends Error {}
export const LIMITS = Object.freeze({bytes:12*1024*1024,entries:50000,activities:2000,dictionary:500,pauses:20000,pausesPerDay:128,snapshots:20000});
const plainRecord = value => value!==null && typeof value==='object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));
function keysOnly(value,allowed){if(!plainRecord(value)||Object.keys(value).some(k=>!allowed.includes(k)))throw new ValidationError('Некорректная структура или неизвестные поля JSON.');}
function boundedJSON(text,maxBytes=LIMITS.bytes){if(typeof text!=='string'||text.length>maxBytes||new TextEncoder().encode(text).length>maxBytes)throw new ValidationError('Слишком большой JSON. Максимум — 12 МБ на журнал.');return JSON.parse(text);}

export const COLORS = ['#42d7a6', '#7ba7ff', '#f5b95f', '#b799fa', '#ee829d', '#6dd4e6', '#c6d788'];
export const TIMEZONES = [
 {
  "id": "Asia/Almaty",
  "city": "Астана",
  "aliases": "Казахстан Astana Kazakhstan"
 },
 {
  "id": "Asia/Almaty",
  "city": "Алматы",
  "aliases": "Казахстан Almaty Kazakhstan"
 },
 {
  "id": "Asia/Almaty",
  "city": "Шымкент",
  "aliases": "Казахстан Shymkent"
 },
 {
  "id": "Asia/Aqtobe",
  "city": "Актобе",
  "aliases": "Казахстан Aktobe"
 },
 {
  "id": "Asia/Aqtau",
  "city": "Актау",
  "aliases": "Казахстан Aktau"
 },
 {
  "id": "Asia/Atyrau",
  "city": "Атырау",
  "aliases": "Казахстан Atyrau"
 },
 {
  "id": "Asia/Qyzylorda",
  "city": "Кызылорда",
  "aliases": "Казахстан Kyzylorda"
 },
 {
  "id": "Asia/Qostanay",
  "city": "Костанай",
  "aliases": "Казахстан Kostanay"
 },
 {
  "id": "Asia/Oral",
  "city": "Уральск",
  "aliases": "Казахстан Oral"
 },
 {
  "id": "Europe/London",
  "city": "Лондон",
  "aliases": "Великобритания London UK"
 },
 {
  "id": "Europe/Paris",
  "city": "Париж",
  "aliases": "Франция Paris France"
 },
 {
  "id": "Europe/Berlin",
  "city": "Берлин",
  "aliases": "Германия Berlin Germany"
 },
 {
  "id": "Europe/Moscow",
  "city": "Москва",
  "aliases": "Россия Moscow Russia"
 },
 {
  "id": "America/New_York",
  "city": "Вашингтон",
  "aliases": "США Washington USA"
 },
 {
  "id": "America/New_York",
  "city": "Нью-Йорк",
  "aliases": "США New York USA"
 },
 {
  "id": "Asia/Shanghai",
  "city": "Пекин",
  "aliases": "Китай Beijing China"
 },
 {
  "id": "Asia/Shanghai",
  "city": "Шанхай",
  "aliases": "Китай Shanghai China"
 },
 {
  "id": "Asia/Tokyo",
  "city": "Токио",
  "aliases": "Япония Tokyo Japan"
 },
 {
  "id": "Asia/Kolkata",
  "city": "Нью-Дели",
  "aliases": "Индия New Delhi India"
 },
 {
  "id": "Asia/Kolkata",
  "city": "Мумбаи",
  "aliases": "Индия Mumbai India"
 },
 {
  "id": "Asia/Seoul",
  "city": "Сеул",
  "aliases": "Южная Корея Seoul Korea"
 },
 {
  "id": "Asia/Singapore",
  "city": "Сингапур",
  "aliases": "Singapore"
 },
 {
  "id": "Asia/Bishkek",
  "city": "Бишкек",
  "aliases": "Кыргызстан Bishkek"
 },
 {
  "id": "Asia/Tashkent",
  "city": "Ташкент",
  "aliases": "Узбекистан Tashkent"
 },
 {
  "id": "Asia/Samarkand",
  "city": "Самарканд",
  "aliases": "Узбекистан Samarkand"
 },
 {
  "id": "Asia/Dushanbe",
  "city": "Душанбе",
  "aliases": "Таджикистан Dushanbe"
 },
 {
  "id": "Asia/Ashgabat",
  "city": "Ашхабад",
  "aliases": "Туркменистан Ashgabat"
 },
 {
  "id": "Asia/Tbilisi",
  "city": "Тбилиси",
  "aliases": "Грузия Tbilisi"
 },
 {
  "id": "Asia/Yerevan",
  "city": "Ереван",
  "aliases": "Армения Yerevan"
 },
 {
  "id": "Asia/Baku",
  "city": "Баку",
  "aliases": "Азербайджан Baku"
 },
 {
  "id": "Europe/Istanbul",
  "city": "Стамбул",
  "aliases": "Турция Istanbul Turkey"
 },
 {
  "id": "Europe/Istanbul",
  "city": "Анкара",
  "aliases": "Турция Ankara Turkey"
 },
 {
  "id": "Asia/Dubai",
  "city": "Дубай",
  "aliases": "ОАЭ Dubai UAE"
 },
 {
  "id": "Asia/Dubai",
  "city": "Абу-Даби",
  "aliases": "ОАЭ Abu Dhabi"
 },
 {
  "id": "Asia/Riyadh",
  "city": "Эр-Рияд",
  "aliases": "Саудовская Аравия Riyadh"
 },
 {
  "id": "Asia/Qatar",
  "city": "Доха",
  "aliases": "Катар Doha Qatar"
 },
 {
  "id": "Asia/Kuwait",
  "city": "Эль-Кувейт",
  "aliases": "Kuwait"
 },
 {
  "id": "Asia/Bahrain",
  "city": "Манама",
  "aliases": "Бахрейн Manama Bahrain"
 },
 {
  "id": "Asia/Muscat",
  "city": "Маскат",
  "aliases": "Оман Muscat Oman"
 },
 {
  "id": "Asia/Tehran",
  "city": "Тегеран",
  "aliases": "Иран Tehran Iran"
 },
 {
  "id": "Asia/Jerusalem",
  "city": "Иерусалим",
  "aliases": "Израиль Jerusalem Israel"
 },
 {
  "id": "Asia/Jerusalem",
  "city": "Тель-Авив",
  "aliases": "Израиль Tel Aviv"
 },
 {
  "id": "Asia/Beirut",
  "city": "Бейрут",
  "aliases": "Ливан Beirut Lebanon"
 },
 {
  "id": "Asia/Amman",
  "city": "Амман",
  "aliases": "Иордания Amman Jordan"
 },
 {
  "id": "Asia/Baghdad",
  "city": "Багдад",
  "aliases": "Ирак Baghdad Iraq"
 },
 {
  "id": "Asia/Kabul",
  "city": "Кабул",
  "aliases": "Афганистан Kabul"
 },
 {
  "id": "Asia/Karachi",
  "city": "Карачи",
  "aliases": "Пакистан Karachi Pakistan"
 },
 {
  "id": "Asia/Karachi",
  "city": "Исламабад",
  "aliases": "Пакистан Islamabad"
 },
 {
  "id": "Asia/Dhaka",
  "city": "Дакка",
  "aliases": "Бангладеш Dhaka"
 },
 {
  "id": "Asia/Kathmandu",
  "city": "Катманду",
  "aliases": "Непал Kathmandu Nepal"
 },
 {
  "id": "Asia/Colombo",
  "city": "Коломбо",
  "aliases": "Шри-Ланка Colombo"
 },
 {
  "id": "Asia/Yangon",
  "city": "Янгон",
  "aliases": "Мьянма Yangon Myanmar"
 },
 {
  "id": "Asia/Bangkok",
  "city": "Бангкок",
  "aliases": "Таиланд Bangkok Thailand"
 },
 {
  "id": "Asia/Ho_Chi_Minh",
  "city": "Хошимин",
  "aliases": "Вьетнам Ho Chi Minh Vietnam"
 },
 {
  "id": "Asia/Ho_Chi_Minh",
  "city": "Ханой",
  "aliases": "Вьетнам Hanoi"
 },
 {
  "id": "Asia/Phnom_Penh",
  "city": "Пномпень",
  "aliases": "Камбоджа Phnom Penh"
 },
 {
  "id": "Asia/Vientiane",
  "city": "Вьентьян",
  "aliases": "Лаос Vientiane Laos"
 },
 {
  "id": "Asia/Kuala_Lumpur",
  "city": "Куала-Лумпур",
  "aliases": "Малайзия Kuala Lumpur Malaysia"
 },
 {
  "id": "Asia/Jakarta",
  "city": "Джакарта",
  "aliases": "Индонезия Jakarta Indonesia"
 },
 {
  "id": "Asia/Makassar",
  "city": "Денпасар",
  "aliases": "Бали Bali Denpasar Indonesia"
 },
 {
  "id": "Asia/Manila",
  "city": "Манила",
  "aliases": "Филиппины Manila Philippines"
 },
 {
  "id": "Asia/Hong_Kong",
  "city": "Гонконг",
  "aliases": "Hong Kong"
 },
 {
  "id": "Asia/Taipei",
  "city": "Тайбэй",
  "aliases": "Тайвань Taipei Taiwan"
 },
 {
  "id": "Asia/Ulaanbaatar",
  "city": "Улан-Батор",
  "aliases": "Монголия Ulaanbaatar Mongolia"
 },
 {
  "id": "Asia/Novosibirsk",
  "city": "Новосибирск",
  "aliases": "Россия Novosibirsk"
 },
 {
  "id": "Asia/Yekaterinburg",
  "city": "Екатеринбург",
  "aliases": "Россия Yekaterinburg"
 },
 {
  "id": "Asia/Omsk",
  "city": "Омск",
  "aliases": "Россия Omsk"
 },
 {
  "id": "Asia/Krasnoyarsk",
  "city": "Красноярск",
  "aliases": "Россия Krasnoyarsk"
 },
 {
  "id": "Asia/Irkutsk",
  "city": "Иркутск",
  "aliases": "Россия Irkutsk"
 },
 {
  "id": "Asia/Yakutsk",
  "city": "Якутск",
  "aliases": "Россия Yakutsk"
 },
 {
  "id": "Asia/Vladivostok",
  "city": "Владивосток",
  "aliases": "Россия Vladivostok"
 },
 {
  "id": "Asia/Magadan",
  "city": "Магадан",
  "aliases": "Россия Magadan"
 },
 {
  "id": "Asia/Kamchatka",
  "city": "Петропавловск-Камчатский",
  "aliases": "Россия Kamchatka"
 },
 {
  "id": "Europe/Samara",
  "city": "Самара",
  "aliases": "Россия Samara"
 },
 {
  "id": "Europe/Kaliningrad",
  "city": "Калининград",
  "aliases": "Россия Kaliningrad"
 },
 {
  "id": "Europe/Minsk",
  "city": "Минск",
  "aliases": "Беларусь Minsk Belarus"
 },
 {
  "id": "Europe/Kyiv",
  "city": "Киев",
  "aliases": "Украина Kyiv Kiev Ukraine"
 },
 {
  "id": "Europe/Chisinau",
  "city": "Кишинёв",
  "aliases": "Молдова Chisinau Moldova"
 },
 {
  "id": "Europe/Riga",
  "city": "Рига",
  "aliases": "Латвия Riga Latvia"
 },
 {
  "id": "Europe/Vilnius",
  "city": "Вильнюс",
  "aliases": "Литва Vilnius Lithuania"
 },
 {
  "id": "Europe/Tallinn",
  "city": "Таллин",
  "aliases": "Эстония Tallinn Estonia"
 },
 {
  "id": "Europe/Helsinki",
  "city": "Хельсинки",
  "aliases": "Финляндия Helsinki Finland"
 },
 {
  "id": "Europe/Stockholm",
  "city": "Стокгольм",
  "aliases": "Швеция Stockholm Sweden"
 },
 {
  "id": "Europe/Oslo",
  "city": "Осло",
  "aliases": "Норвегия Oslo Norway"
 },
 {
  "id": "Europe/Copenhagen",
  "city": "Копенгаген",
  "aliases": "Дания Copenhagen Denmark"
 },
 {
  "id": "Atlantic/Reykjavik",
  "city": "Рейкьявик",
  "aliases": "Исландия Reykjavik Iceland"
 },
 {
  "id": "Europe/Dublin",
  "city": "Дублин",
  "aliases": "Ирландия Dublin Ireland"
 },
 {
  "id": "Europe/Lisbon",
  "city": "Лиссабон",
  "aliases": "Португалия Lisbon Portugal"
 },
 {
  "id": "Europe/Madrid",
  "city": "Мадрид",
  "aliases": "Испания Madrid Spain"
 },
 {
  "id": "Europe/Madrid",
  "city": "Барселона",
  "aliases": "Испания Barcelona"
 },
 {
  "id": "Europe/Rome",
  "city": "Рим",
  "aliases": "Италия Rome Italy"
 },
 {
  "id": "Europe/Rome",
  "city": "Милан",
  "aliases": "Италия Milan"
 },
 {
  "id": "Europe/Zurich",
  "city": "Цюрих",
  "aliases": "Швейцария Zurich Switzerland"
 },
 {
  "id": "Europe/Vienna",
  "city": "Вена",
  "aliases": "Австрия Vienna Austria"
 },
 {
  "id": "Europe/Prague",
  "city": "Прага",
  "aliases": "Чехия Prague Czechia"
 },
 {
  "id": "Europe/Warsaw",
  "city": "Варшава",
  "aliases": "Польша Warsaw Poland"
 },
 {
  "id": "Europe/Budapest",
  "city": "Будапешт",
  "aliases": "Венгрия Budapest Hungary"
 },
 {
  "id": "Europe/Bratislava",
  "city": "Братислава",
  "aliases": "Словакия Bratislava Slovakia"
 },
 {
  "id": "Europe/Belgrade",
  "city": "Белград",
  "aliases": "Сербия Belgrade Serbia"
 },
 {
  "id": "Europe/Zagreb",
  "city": "Загреб",
  "aliases": "Хорватия Zagreb Croatia"
 },
 {
  "id": "Europe/Ljubljana",
  "city": "Любляна",
  "aliases": "Словения Ljubljana Slovenia"
 },
 {
  "id": "Europe/Sarajevo",
  "city": "Сараево",
  "aliases": "Босния Sarajevo Bosnia"
 },
 {
  "id": "Europe/Skopje",
  "city": "Скопье",
  "aliases": "Северная Македония Skopje"
 },
 {
  "id": "Europe/Tirane",
  "city": "Тирана",
  "aliases": "Албания Tirana Albania"
 },
 {
  "id": "Europe/Athens",
  "city": "Афины",
  "aliases": "Греция Athens Greece"
 },
 {
  "id": "Europe/Sofia",
  "city": "София",
  "aliases": "Болгария Sofia Bulgaria"
 },
 {
  "id": "Europe/Bucharest",
  "city": "Бухарест",
  "aliases": "Румыния Bucharest Romania"
 },
 {
  "id": "Europe/Brussels",
  "city": "Брюссель",
  "aliases": "Бельгия Brussels Belgium"
 },
 {
  "id": "Europe/Amsterdam",
  "city": "Амстердам",
  "aliases": "Нидерланды Amsterdam Netherlands"
 },
 {
  "id": "Europe/Luxembourg",
  "city": "Люксембург",
  "aliases": "Luxembourg"
 },
 {
  "id": "Europe/Malta",
  "city": "Валлетта",
  "aliases": "Мальта Valletta Malta"
 },
 {
  "id": "Asia/Nicosia",
  "city": "Никосия",
  "aliases": "Кипр Nicosia Cyprus"
 },
 {
  "id": "Africa/Cairo",
  "city": "Каир",
  "aliases": "Египет Cairo Egypt"
 },
 {
  "id": "Africa/Casablanca",
  "city": "Касабланка",
  "aliases": "Марокко Casablanca Morocco"
 },
 {
  "id": "Africa/Tunis",
  "city": "Тунис",
  "aliases": "Tunisia Tunis"
 },
 {
  "id": "Africa/Algiers",
  "city": "Алжир",
  "aliases": "Algiers Algeria"
 },
 {
  "id": "Africa/Tripoli",
  "city": "Триполи",
  "aliases": "Ливия Tripoli Libya"
 },
 {
  "id": "Africa/Nairobi",
  "city": "Найроби",
  "aliases": "Кения Nairobi Kenya"
 },
 {
  "id": "Africa/Addis_Ababa",
  "city": "Аддис-Абеба",
  "aliases": "Эфиопия Addis Ababa Ethiopia"
 },
 {
  "id": "Africa/Johannesburg",
  "city": "Йоханнесбург",
  "aliases": "ЮАР Johannesburg South Africa"
 },
 {
  "id": "Africa/Johannesburg",
  "city": "Кейптаун",
  "aliases": "ЮАР Cape Town"
 },
 {
  "id": "Africa/Lagos",
  "city": "Лагос",
  "aliases": "Нигерия Lagos Nigeria"
 },
 {
  "id": "Africa/Accra",
  "city": "Аккра",
  "aliases": "Гана Accra Ghana"
 },
 {
  "id": "Africa/Dakar",
  "city": "Дакар",
  "aliases": "Сенегал Dakar Senegal"
 },
 {
  "id": "Africa/Abidjan",
  "city": "Абиджан",
  "aliases": "Кот-д'Ивуар Abidjan"
 },
 {
  "id": "Africa/Kigali",
  "city": "Кигали",
  "aliases": "Руанда Kigali Rwanda"
 },
 {
  "id": "Africa/Kampala",
  "city": "Кампала",
  "aliases": "Уганда Kampala Uganda"
 },
 {
  "id": "Indian/Mauritius",
  "city": "Порт-Луи",
  "aliases": "Маврикий Port Louis Mauritius"
 },
 {
  "id": "Indian/Maldives",
  "city": "Мале",
  "aliases": "Мальдивы Male Maldives"
 },
 {
  "id": "America/Chicago",
  "city": "Чикаго",
  "aliases": "США Chicago USA"
 },
 {
  "id": "America/Denver",
  "city": "Денвер",
  "aliases": "США Denver USA"
 },
 {
  "id": "America/Los_Angeles",
  "city": "Лос-Анджелес",
  "aliases": "США Los Angeles USA"
 },
 {
  "id": "America/Los_Angeles",
  "city": "Сан-Франциско",
  "aliases": "США San Francisco USA"
 },
 {
  "id": "America/Phoenix",
  "city": "Финикс",
  "aliases": "США Phoenix USA"
 },
 {
  "id": "America/Anchorage",
  "city": "Анкоридж",
  "aliases": "США Аляска Anchorage Alaska"
 },
 {
  "id": "Pacific/Honolulu",
  "city": "Гонолулу",
  "aliases": "США Гавайи Honolulu Hawaii"
 },
 {
  "id": "America/Toronto",
  "city": "Торонто",
  "aliases": "Канада Toronto Canada"
 },
 {
  "id": "America/Vancouver",
  "city": "Ванкувер",
  "aliases": "Канада Vancouver Canada"
 },
 {
  "id": "America/Edmonton",
  "city": "Эдмонтон",
  "aliases": "Канада Edmonton Canada"
 },
 {
  "id": "America/Winnipeg",
  "city": "Виннипег",
  "aliases": "Канада Winnipeg Canada"
 },
 {
  "id": "America/Halifax",
  "city": "Галифакс",
  "aliases": "Канада Halifax Canada"
 },
 {
  "id": "America/St_Johns",
  "city": "Сент-Джонс",
  "aliases": "Канада St Johns Canada"
 },
 {
  "id": "America/Mexico_City",
  "city": "Мехико",
  "aliases": "Мексика Mexico City"
 },
 {
  "id": "America/Cancun",
  "city": "Канкун",
  "aliases": "Мексика Cancun Mexico"
 },
 {
  "id": "America/Havana",
  "city": "Гавана",
  "aliases": "Куба Havana Cuba"
 },
 {
  "id": "America/Panama",
  "city": "Панама",
  "aliases": "Panama"
 },
 {
  "id": "America/Costa_Rica",
  "city": "Сан-Хосе",
  "aliases": "Коста-Рика San Jose Costa Rica"
 },
 {
  "id": "America/Bogota",
  "city": "Богота",
  "aliases": "Колумбия Bogota Colombia"
 },
 {
  "id": "America/Lima",
  "city": "Лима",
  "aliases": "Перу Lima Peru"
 },
 {
  "id": "America/Caracas",
  "city": "Каракас",
  "aliases": "Венесуэла Caracas Venezuela"
 },
 {
  "id": "America/La_Paz",
  "city": "Ла-Пас",
  "aliases": "Боливия La Paz Bolivia"
 },
 {
  "id": "America/Santiago",
  "city": "Сантьяго",
  "aliases": "Чили Santiago Chile"
 },
 {
  "id": "America/Argentina/Buenos_Aires",
  "city": "Буэнос-Айрес",
  "aliases": "Аргентина Buenos Aires Argentina"
 },
 {
  "id": "America/Montevideo",
  "city": "Монтевидео",
  "aliases": "Уругвай Montevideo Uruguay"
 },
 {
  "id": "America/Asuncion",
  "city": "Асунсьон",
  "aliases": "Парагвай Asuncion Paraguay"
 },
 {
  "id": "America/Sao_Paulo",
  "city": "Сан-Паулу",
  "aliases": "Бразилия Sao Paulo Brazil"
 },
 {
  "id": "America/Sao_Paulo",
  "city": "Рио-де-Жанейро",
  "aliases": "Бразилия Rio de Janeiro"
 },
 {
  "id": "America/Manaus",
  "city": "Манаус",
  "aliases": "Бразилия Manaus Brazil"
 },
 {
  "id": "Australia/Sydney",
  "city": "Сидней",
  "aliases": "Австралия Sydney Australia"
 },
 {
  "id": "Australia/Melbourne",
  "city": "Мельбурн",
  "aliases": "Австралия Melbourne Australia"
 },
 {
  "id": "Australia/Brisbane",
  "city": "Брисбен",
  "aliases": "Австралия Brisbane Australia"
 },
 {
  "id": "Australia/Adelaide",
  "city": "Аделаида",
  "aliases": "Австралия Adelaide Australia"
 },
 {
  "id": "Australia/Perth",
  "city": "Перт",
  "aliases": "Австралия Perth Australia"
 },
 {
  "id": "Australia/Darwin",
  "city": "Дарвин",
  "aliases": "Австралия Darwin Australia"
 },
 {
  "id": "Australia/Hobart",
  "city": "Хобарт",
  "aliases": "Австралия Hobart Australia"
 },
 {
  "id": "Pacific/Auckland",
  "city": "Окленд",
  "aliases": "Новая Зеландия Auckland New Zealand"
 },
 {
  "id": "Pacific/Chatham",
  "city": "Чатем",
  "aliases": "Новая Зеландия Chatham"
 },
 {
  "id": "Pacific/Fiji",
  "city": "Сува",
  "aliases": "Фиджи Suva Fiji"
 },
 {
  "id": "Pacific/Port_Moresby",
  "city": "Порт-Морсби",
  "aliases": "Папуа New Guinea Port Moresby"
 },
 {
  "id": "Pacific/Guam",
  "city": "Хагатна",
  "aliases": "Гуам Hagatna Guam"
 },
 {
  "id": "Pacific/Apia",
  "city": "Апиа",
  "aliases": "Самоа Apia Samoa"
 },
 {
  "id": "Pacific/Tongatapu",
  "city": "Нукуалофа",
  "aliases": "Тонга Nuku alofa Tonga"
 }
];
export const DEFAULT_TIMEZONE = 'Europe/London';
export function timezoneLabel(zone,at=new Date()) {
  const offset=new Intl.DateTimeFormat('en-GB',{timeZone:zone.id,timeZoneName:'longOffset'}).formatToParts(at).find(p=>p.type==='timeZoneName')?.value.replace('GMT','UTC').replace(/^UTC$/,'UTC+00:00')||'';
  return `${zone.city} · ${offset}`;
}
export const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const clone = value => JSON.parse(JSON.stringify(value));
export const minutes = text => { const [h, m] = String(text).split(':').map(Number); return h * 60 + m; };
export const clock = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
export function duration(n) { n = Math.round(n); return n < 60 ? `${n} мин` : `${Math.floor(n / 60)} ч${n % 60 ? ` ${n % 60} мин` : ''}`; }
export function localNow(timezone = DEFAULT_TIMEZONE, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone: timezone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23'}).formatToParts(now).map(p => [p.type, p.value]));
  return {date: `${parts.year}-${parts.month}-${parts.day}`, minute: +parts.hour * 60 + +parts.minute};
}
export function addDays(date, n) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0,10); }
export function instantForLocal(date,time,zone){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return null;
 const [hour,minute]=time.split(':').map(Number),target=hour*60+minute;
 let instant=Date.parse(`${date}T${time}:00Z`);
 for(let i=0;i<3;i++){
  const local=localNow(zone,new Date(instant)),dayDelta=Math.round((Date.parse(`${date}T00:00:00Z`)-Date.parse(`${local.date}T00:00:00Z`))/86400000);
  const delta=dayDelta*1440+target-local.minute;if(!delta)break;instant+=delta*60000;
 }
 const actual=localNow(zone,new Date(instant));return actual.date===date&&actual.minute===target?new Date(instant):null;
}
export function weekday(date) { return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7; }
export function weekDates(date) { const monday = addDays(date, -weekday(date)); return Array.from({length:7}, (_, i) => addDays(monday, i)); }
export function dateLabel(date, options = {day:'numeric', month:'long'}) { return new Intl.DateTimeFormat('ru-RU', {...options, timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`)); }
export function emptyWorkspace() {
  return {displayName:'Гость',entries: [], dayEvents:[], categories: ['Работа','Обучение','Отдых','Спорт','Быт','Общение'].map((name,i) => ({id:`cat-${i}`,name,color:COLORS[i],archived:false})), projects: [{id:'p-1',name:'Проект 1',archived:false},{id:'p-2',name:'Проект 2',archived:false}], settings:{timezone:DEFAULT_TIMEZONE,start:540,end:1320,step:30,days:[0,1,2,3,4,5,6],confirmed:false}, snapshots:{}, pauses:[], telegram:'disconnected'};
}
export function ensureDay(workspace, date) {
  if (!validDate(date)) throw new ValidationError('Некорректная дата.');
  if (!Object.hasOwn(workspace.snapshots,date)) workspace.snapshots[date] = clone(workspace.settings);
  return workspace.snapshots[date];
}
export function schedule(workspace, date) { return workspace.snapshots[date] ?? workspace.settings; }
// Shared clock-aligned interval for new site entries and unsolicited bot messages.
export function currentInterval(w,at=new Date()){
 let local=localNow(w.settings.timezone,at),s=schedule(w,local.date);
 local=localNow(s.timezone,at);s=schedule(w,local.date);
 const wake=w.dayEvents?.find(e=>e.date===local.date&&e.type==='wake');
 const anchor=wake&&local.minute>=s.start&&local.minute<s.end?Math.max(s.start,localNow(wake.timezone,new Date(wake.at)).minute):0;
 const start=anchor&&local.minute>=anchor?anchor+Math.floor((local.minute-anchor)/s.step)*s.step:Math.floor(local.minute/s.step)*s.step;
 return {date:local.date,start,end:Math.min(start+s.step,1440),timezone:s.timezone};
}
export function validateEntryMoment(entry,workspace,at=new Date(),original=null){
 if(!validDate(entry.date))throw new ValidationError('Некорректная дата.');
 const s=schedule(workspace,entry.date),local=localNow(s.timezone,at);
 if(entry.date<local.date||(entry.date===local.date&&entry.end<=local.minute))return true;
 const currentEnd=currentInterval(workspace,at).end;
 if(entry.date===local.date&&entry.start<=local.minute&&entry.end<=currentEnd)return true;
 if(original?.activities&&entry.date===original.date&&entry.start===original.start&&entry.end===original.end&&entry.date===local.date&&entry.start<=local.minute)return true;
 throw new ValidationError('Можно сохранить прошедшее время или текущий интервал. Будущий интервал ещё не начался; проверьте дату и время.');
}
export function overlap(a, b) { return a.start < b.end && b.start < a.end; }
export function activityPreview(activities){
 return activities.slice(0,3).map(a=>a.text.length>100?a.text.slice(0,99)+'…':a.text).join(' · ')+(activities.length>3?` · ещё ${activities.length-3}`:'');
}
export function appendActivity(entry,activity){
 const activities=entry.activities?clone(entry.activities):[{id:uid(),at:null,text:entry.text}];
 activities.push(activity);return {...entry,activities,text:activityPreview(activities)};
}
export function reviseActivity(entry,id,text){
 if(typeof text!=='string'||!text.trim()||text.length>2000)throw new ValidationError('Введите занятие длиной до 2000 символов.');
 if(!entry.activities?.some(a=>a.id===id))throw new ValidationError('Занятие не найдено.');
 const activities=entry.activities.map(a=>a.id===id?{...a,text:text.trim()}:a);return {...entry,activities,text:activityPreview(activities)};
}
export function removeActivity(entry,id){
 if(!entry.activities?.some(a=>a.id===id))throw new ValidationError('Занятие не найдено.');
 const activities=entry.activities.filter(a=>a.id!==id);return activities.length?{...entry,activities,text:activityPreview(activities)}:null;
}
export function validateEntries(entries, categories = [], projects = []) {
  if (!Array.isArray(entries) || entries.length > LIMITS.entries) throw new ValidationError('Некорректный список записей.');
  const ids = new Set(); const sorted = [];
  const categoryIds=new Set(categories.map(c=>c.id)),projectIds=new Set(projects.map(p=>p.id));
  for (const e of entries) {
    keysOnly(e,['id','date','start','end','text','category','project','source','activities']);
    if (!e || typeof e.id !== 'string' || !/^[a-z0-9-]{1,100}$/i.test(e.id) || ids.has(e.id)) throw new ValidationError('В записях есть некорректные или повторяющиеся идентификаторы.');
    ids.add(e.id);
    if (!validDate(e.date) || !Number.isInteger(e.start) || !Number.isInteger(e.end) || e.start < 0 || e.end > 1440 || e.start >= e.end) throw new ValidationError('Проверьте дату и время: конец должен быть позже начала в пределах одного дня.');
    if (typeof e.text !== 'string' || !e.text.trim() || e.text.length > 2000) throw new ValidationError('Введите занятие длиной до 2000 символов.');
    if('activities' in e){
      if(!Array.isArray(e.activities)||!e.activities.length||e.activities.length>LIMITS.activities)throw new ValidationError('В одном интервале допускается от 1 до 2000 занятий.');
      const activityIds=new Set();
      for(const a of e.activities){
        keysOnly(a,['id','at','text']);
        if(typeof a.id!=='string'||!/^[a-z0-9-]{1,100}$/i.test(a.id)||activityIds.has(a.id)||typeof a.text!=='string'||!a.text.trim()||a.text.length>2000)throw new ValidationError('Некорректное занятие внутри интервала.');
        if(a.at!==null&&(typeof a.at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(a.at)||isNaN(Date.parse(a.at))||new Date(a.at).toISOString()!==a.at))throw new ValidationError('Некорректное время сообщения занятия.');
        activityIds.add(a.id);
      }
    }
    if (typeof e.category!=='string'||(e.category && !categoryIds.has(e.category))) throw new ValidationError('Категория не найдена.');
    if (typeof e.project!=='string'||(e.project && !projectIds.has(e.project))) throw new ValidationError('Проект не найден.');
    if (!['site','telegram-demo','telegram'].includes(e.source)) throw new ValidationError('Неизвестный источник записи.');
    sorted.push(e);
  }
  sorted.sort((a,b) => a.date.localeCompare(b.date) || a.start-b.start);
  for(let i=1;i<sorted.length;i++) if(sorted[i].date === sorted[i-1].date && overlap(sorted[i], sorted[i-1])) throw new ValidationError('Этот интервал пересекается с другой записью. Измените время или сначала исправьте существующую запись.');
  return true;
}
export function validDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) && new Date(`${s}T12:00:00Z`).toISOString().slice(0,10) === s; }
export function validateSettings(s) {
  keysOnly(s,['timezone','timezoneCity','start','end','step','days','confirmed']);
  if(!s || !Number.isInteger(s.start) || !Number.isInteger(s.end) || s.start<0 || s.end>1440 || s.start>=s.end || ![15,30,60].includes(s.step) || !Array.isArray(s.days) || !s.days.length || s.days.some(d=>!Number.isInteger(d)||d<0||d>6) || new Set(s.days).size !== s.days.length || typeof s.confirmed !== 'boolean') throw new ValidationError('Проверьте часы, шаг и дни учёта. Ночные окна через полночь пока не поддерживаются.');
  if('timezoneCity' in s&&(typeof s.timezoneCity!=='string'||s.timezoneCity.length>80||/[\u0000-\u001f\u007f]/.test(s.timezoneCity)))throw new ValidationError('Некорректное название города.');
  // Legacy UTC remains readable in saved journals and historical snapshots.
  if(!TIMEZONES.some(zone=>zone.id===s.timezone)&&s.timezone!=='UTC') throw new ValidationError('Этот часовой пояс пока не поддерживается.');
  return true;
}
export function validateWorkspace(w) {
  keysOnly(w,['entries','dayEvents','categories','projects','projectsEnabled','settings','snapshots','pauses','telegram','displayName','productivity']);
  if('projectsEnabled' in w&&typeof w.projectsEnabled!=='boolean')throw new ValidationError('Некорректная настройка проектов.');
  if('dayEvents' in w){
    if(!Array.isArray(w.dayEvents)||w.dayEvents.length>LIMITS.snapshots*2)throw new ValidationError('Некорректные отметки дня.');
    const unique=new Set();
    for(const event of w.dayEvents){keysOnly(event,['date','type','at','timezone']);const key=event.date+'|'+event.type;
      const zoneValid=typeof event.timezone==='string'&&(TIMEZONES.some(z=>z.id===event.timezone)||event.timezone==='UTC');
      const actual=zoneValid&&typeof event.at==='string'&&Number.isFinite(Date.parse(event.at))?localNow(event.timezone,new Date(event.at)):null;
      if(!validDate(event.date)||!['wake','sleep'].includes(event.type)||typeof event.at!=='string'||!actual||unique.has(key)||!(actual.date===event.date||event.type==='sleep'&&actual.date===addDays(event.date,1)&&actual.minute<720))throw new ValidationError('Некорректная отметка дня.');
      unique.add(key);
    }
  }
  if('productivity' in w){if(!plainRecord(w.productivity))throw new ValidationError('Некорректная формула продуктивности.');keysOnly(w.productivity,['basis']);if(!['logged','scheduled'].includes(w.productivity.basis))throw new ValidationError('Некорректная формула продуктивности.');}
  if('displayName' in w&&(typeof w.displayName!=='string'||!w.displayName.trim()||w.displayName.length>60||/[\u0000-\u001f\u007f]/.test(w.displayName)))throw new ValidationError('Введите имя от 1 до 60 символов без переносов строки.');
  if(!Array.isArray(w.categories)||!Array.isArray(w.projects)||!plainRecord(w.snapshots)||!Array.isArray(w.pauses))throw new ValidationError('Файл не содержит дневник Ритма.');
  for(const [type,items] of [['categories',w.categories],['projects',w.projects]]){
    if(items.length>LIMITS.dictionary)throw new ValidationError('Слишком много категорий или проектов. Максимум — 500.');
    const ids=new Set();
    for(const c of items){
      keysOnly(c,type==='categories'?['id','name','color','archived','productive','weight']:['id','name','archived']);
      if(typeof c.id!=='string'||!/^[a-z0-9-]{1,100}$/i.test(c.id)||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim()||c.name.length>80||typeof c.archived!=='boolean')throw new ValidationError('Некорректное название или идентификатор категории или проекта.');
      if(type==='categories'&&'productive' in c&&typeof c.productive!=='boolean')throw new ValidationError('Некорректная цель категории.');
      if(type==='categories'&&'weight' in c&&(!Number.isInteger(c.weight)||c.weight<0||c.weight>100))throw new ValidationError('Вес категории должен быть от 0 до 100.');
      ids.add(c.id);
      if(type==='categories'&&(typeof c.color!=='string'||!/^#[0-9a-f]{6}$/i.test(c.color)))throw new ValidationError('Некорректный цвет категории: нужна строка HEX.');
    }
  }
  validateSettings(w.settings);
  if(Object.keys(w.snapshots).length>LIMITS.snapshots)throw new ValidationError('Слишком много дней расписания. Максимум — 20000.');
  for(const [date,s] of Object.entries(w.snapshots)){if(!validDate(date))throw new ValidationError('Некорректная дата расписания.');validateSettings(s);}
  if(w.pauses.length>LIMITS.pauses)throw new ValidationError('Слишком много пауз. Максимум — 20000.');
  const dailyPauses=new Map();
  for(const p of w.pauses){
    keysOnly(p,['date','start','end','type']);
    if(!validDate(p.date)||!Number.isInteger(p.start)||!Number.isInteger(p.end)||p.start<0||p.end>1440||p.start>=p.end||('type' in p&&!['pause','ended'].includes(p.type)))throw new ValidationError('Некорректная пауза.');
    const n=(dailyPauses.get(p.date)||0)+1;dailyPauses.set(p.date,n);if(n>LIMITS.pausesPerDay)throw new ValidationError('Слишком много пауз за один день. Максимум — 128.');
  }
  if(!['disconnected','connected','error'].includes(w.telegram))throw new ValidationError('Некорректное состояние демонстрации Telegram.');
  validateEntries(w.entries,w.categories,w.projects);return true;
}
export function normalizeWorkspace(w){validateWorkspace(w);const value=clone(w);for(const e of value.entries)if(e.activities)e.text=activityPreview(e.activities);return value;}
export function normalizeStore(value){
  keysOnly(value,['version','mode','workspaces']);
  if(![1,SCHEMA_VERSION].includes(value.version)||!['demo','user'].includes(value.mode))throw new ValidationError('Неизвестная версия дневника.');
  keysOnly(value.workspaces,['demo','user']);
  return {version:SCHEMA_VERSION,mode:value.mode,workspaces:{demo:normalizeWorkspace(value.workspaces.demo),user:normalizeWorkspace(value.workspaces.user)}};
}
export function parseStore(text){return normalizeStore(boundedJSON(text,LIMITS.bytes*2));}
export function parseImport(text){
  const value=boundedJSON(text);keysOnly(value,['version','workspace','mode','exportedAt']);
  if(![1,SCHEMA_VERSION].includes(value.version))throw new ValidationError('Версия JSON не поддерживается.');
  if('mode' in value&&!['demo','user'].includes(value.mode))throw new ValidationError('Некорректный режим журнала.');
  if('exportedAt' in value&&(typeof value.exportedAt!=='string'||value.exportedAt.length>40||isNaN(Date.parse(value.exportedAt))))throw new ValidationError('Некорректная дата экспорта.');
  return normalizeWorkspace(value.workspace);
}
export function mergedRanges(ranges) {
  const out=[];
  for(const r of [...ranges].filter(r=>r.end>r.start).sort((a,b)=>a.start-b.start)) { const last=out.at(-1); if(last&&r.start<=last.end) last.end=Math.max(last.end,r.end); else out.push({...r}); }
  return out;
}
export function subtractRanges(base, cuts) {
  let out=base;
  for(const cut of mergedRanges(cuts)) out=out.flatMap(r=>!overlap(r,cut)?[r]:[{start:r.start,end:Math.min(r.end,cut.start)},{start:Math.max(r.start,cut.end),end:r.end}].filter(r=>r.end>r.start));
  return out;
}
const length = ranges => ranges.reduce((n,r)=>n+r.end-r.start,0);
function trackingBounds(w,date) {
  const s=schedule(w,date);
  const wake=w.dayEvents?.find(e=>e.date===date&&e.type==='wake');
  const sleep=w.dayEvents?.find(e=>e.date===date&&e.type==='sleep');
  const waking=wake?localNow(s.timezone,new Date(wake.at)):null;
  const bedtime=sleep?localNow(s.timezone,new Date(sleep.at)):null;
  return {start:waking?.date===date?Math.max(s.start,waking.minute):s.start,end:bedtime?.date===date?Math.min(s.end,bedtime.minute):s.end};
}
export function expectedRanges(w,date,now=localNow(schedule(w,date).timezone)) {
  const s=schedule(w,date);if(!s.days.includes(weekday(date))||date>now.date) return [];
  const bounds=trackingBounds(w,date),end=date===now.date?Math.min(bounds.end,now.minute):bounds.end;
  if(end<=bounds.start)return [];
  return subtractRanges([{start:bounds.start,end}],w.pauses.filter(p=>p.date===date));
}
export function summary(w,dates,now) {
  let expected=0,tracked=0,within=0,paused=0;const categories=Object.create(null),projects=Object.create(null);
  for(const date of dates) {
    const s=schedule(w,date),dayClock=now??localNow(s.timezone);
    const ranges=expectedRanges(w,date,dayClock);expected+=length(ranges);
    const bounds=trackingBounds(w,date),end=date===dayClock.date?Math.min(bounds.end,dayClock.minute):date>dayClock.date?bounds.start:bounds.end;
    if(s.days.includes(weekday(date))) paused+=Math.max(0,end-bounds.start)-length(ranges);
    for(const e of w.entries.filter(e=>e.date===date)) {
      const n=e.end-e.start;tracked+=n;categories[e.category]=(categories[e.category]||0)+n;projects[e.project]=(projects[e.project]||0)+n;
      for(const r of ranges) within+=Math.max(0,Math.min(e.end,r.end)-Math.max(e.start,r.start));
    }
  }
  return {expected,tracked,within,paused,missing:Math.max(0,expected-within),outside:Math.max(0,tracked-within),coverage:expected?Math.min(100,Math.round(within/expected*100)):0,categories,projects};
}
export function slots(w,date,now=localNow(schedule(w,date).timezone)) {
  const s=schedule(w,date);
  const result=[]; const entries=w.entries.filter(e=>e.date===date).sort((a,b)=>a.start-b.start);
  if(!s.days.includes(weekday(date)))return entries.map(e=>({...e,status:'entry'}));
  const cuts=mergedRanges(w.pauses.filter(p=>p.date===date));
  const bounds=trackingBounds(w,date);
  for(let start=bounds.start;start<bounds.end;start+=s.step) {
    const end=Math.min(start+s.step,bounds.end);
    for(const r of subtractRanges([{start,end}],entries)) {
      const boundaries=[r.start,r.end,...cuts.flatMap(c=>[c.start,c.end]).filter(n=>n>r.start&&n<r.end)].sort((a,b)=>a-b);
      for(let i=0;i<boundaries.length-1;i++){const part={start:boundaries[i],end:boundaries[i+1]};result.push({...part,date,status:cuts.some(c=>overlap(c,part))?'pause':date>now.date||(date===now.date&&part.end>now.minute)?'future':'missing'});}
    }
  }
  return [...entries.map(e=>({...e,status:'entry'})),...result].sort((a,b)=>a.start-b.start);
}
export function nextGap(w,date,now=localNow(schedule(w,date).timezone)) { return slots(w,date,now).find(s=>s.status==='missing') ?? null; }
// Display-only markers: always subtract the complete journal, even when entries are filtered.
export function journalTimeline(w,entries,from,to,at=new Date(),includeMissing=true) {
  const rows=[...entries];
  if(includeMissing&&validDate(from)&&validDate(to)&&from<=to) {
    for(let date=from;date<=to;) {
      const s=schedule(w,date),current=localNow(s.timezone,at);
      if(date>current.date)break;
      const sleep=w.dayEvents?.find(e=>e.date===date&&e.type==='sleep');
      const bedtime=sleep?localNow(s.timezone,new Date(sleep.at)):null;
      const limit=bedtime?.date===date?bedtime.minute:s.end;
      for(const slot of slots(w,date,current)) {
        if(!['missing','future'].includes(slot.status))continue;
        const end=Math.min(slot.end,limit);
        if(end>slot.start&&(date<current.date||end<=current.minute))rows.push({date,start:slot.start,end,status:'missing'});
      }
      if(date===to)break;
      date=addDays(date,1);
    }
  }
  return rows.sort((a,b)=>b.date.localeCompare(a.date)||b.start-a.start);
}
export function nextPrompt(w,now=localNow(w.settings.timezone)) {
  const s=schedule(w,now.date);if(!s.days.includes(weekday(now.date))||now.minute>=s.end)return null;
  const start=s.start+Math.max(0,Math.floor((now.minute-s.start)/s.step))*s.step;
  const range={start,end:Math.min(start+s.step,s.end)};
  if(w.pauses.some(p=>p.date===now.date&&p.start<=now.minute&&p.end>now.minute))return null;
  return range;
}
export function seedWorkspace() {
  const w=emptyWorkspace();w.settings.confirmed=true;w.telegram='connected';const today=localNow().date;
  const rows=[[540,600,'Разобрал задачи на день','cat-0','p-1'],[600,690,'Исследовал второй проект','cat-0','p-2'],[690,720,'Завтрак и небольшая прогулка','cat-4',''],[750,810,'Читал документацию','cat-1','p-2'],[810,840,'Обед','cat-4',''],[840,900,'Работал над проектом','cat-0','p-1']];
  for(let d=-6;d<=0;d++) {const date=addDays(today,d);ensureDay(w,date);for(const [start,end,text,category,project] of rows) { if(d===0&&end>localNow().minute)continue;w.entries.push({id:uid(),date,start,end,text,category,project,source:'site'});}}
  return w;
}
export function createStore() {return {version:SCHEMA_VERSION,mode:'demo',workspaces:{demo:seedWorkspace(),user:emptyWorkspace()}};}
export function csvRows(entries,w,language='ru') {
  const cell=v=>{let s=String(v??'');if(/^[=+@\-\t\r\n\u0000-\u001f\u007f-\u009f＝＋－＠]/u.test(s)||/^[\s\uFEFF]*[=+@\-＝＋－＠]/u.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
  return '\ufeff'+[language==='en'?['Date','Start','End','Minutes','Activity','Category','Project','Source']:['Дата','Начало','Конец','Минуты','Занятие','Категория','Проект','Источник'],...entries.map(e=>[e.date,clock(e.start),clock(e.end),e.end-e.start,e.activities?e.activities.map(a=>(a.at?(()=>{const sent=localNow(schedule(w,e.date).timezone,new Date(a.at));return sent.date+' '+clock(sent.minute);})():language==='en'?'Message time unknown':'Время сообщения неизвестно')+' — '+a.text).join('\n'):e.text,w.categories.find(c=>c.id===e.category)?.name??'',w.projects.find(p=>p.id===e.project)?.name??'',e.source==='telegram'?'Telegram':e.source==='site'?(language==='en'?'Website':'Сайт'):(language==='en'?'Bot demo':'Демонстрация бота')])].map(row=>row.map(cell).join(';')).join('\r\n');
}

// Goals are chosen by the owner. No category is judged automatically.
export const categoryWeight=c=>c?.weight??(c?.productive===true?100:0);
export function activityMatrix(w,{from,to}={}){
 if(!validDate(from)||!validDate(to)||from>to)throw new ValidationError('Проверьте период тенденций.');
 const days=Math.round((Date.parse(to)-Date.parse(from))/86400000)+1;
 if(days>366)throw new ValidationError('Выберите период не длиннее 366 дней.');
 const dates=[];
 for(let date=from;date<=to;date=addDays(date,1))dates.push(date);
 const cells=new Map();for(const e of w.entries)if(e.date>=from&&e.date<=to){const key=e.category+'|'+e.date;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(e);}
 return {dates,clipped:false,categories:[...w.categories,{id:'',name:'Без категории',color:'#a6bbb4'}],cells};
}
export function trendRows(w,{from,to,group='day',at=new Date()}={}){
 if(!validDate(from)||!validDate(to)||from>to||!['day','month'].includes(group))throw new ValidationError('Проверьте период тенденций.');
 const days=Math.round((Date.parse(to)-Date.parse(from))/86400000)+1;
 if(days>366)throw new ValidationError('Выберите период не длиннее 366 дней.');
 const goals=new Set(w.categories.filter(c=>categoryWeight(c)>0).map(c=>c.id)),weights=new Map(w.categories.map(c=>[c.id,categoryWeight(c)])),basis=w.productivity?.basis??'logged',entriesByDay=new Map(),groups=new Map();
 for(const e of w.entries)if(e.date>=from&&e.date<=to){if(!entriesByDay.has(e.date))entriesByDay.set(e.date,[]);entriesByDay.get(e.date).push(e);}
 for(let date=from;date<=to;date=addDays(date,1)){
  const entries=entriesByDay.get(date)||[],s=summary({...w,entries},[date],localNow(schedule(w,date).timezone,at));
  const key=group==='month'?date.slice(0,7):date;
  if(!groups.has(key))groups.set(key,{key,from:date,to:date,tracked:0,target:0,weighted:0,expected:0,within:0,missing:0,count:0,hasGoals:goals.size>0});
  const row=groups.get(key);row.to=date;row.tracked+=s.tracked;row.expected+=s.expected;row.within+=s.within;row.missing+=s.missing;row.count+=entries.length;
  row.target+=entries.filter(e=>goals.has(e.category)).reduce((sum,e)=>sum+e.end-e.start,0);
  row.weighted+=entries.reduce((sum,e)=>sum+(e.end-e.start)*(weights.get(e.category)??0)/100,0);
 }
 return [...groups.values()].map(row=>({...row,score:row.hasGoals&&row.tracked?Math.round(row.weighted/(basis==='scheduled'?Math.max(row.tracked,row.expected):row.tracked)*100):null,coverage:row.expected?Math.min(100,Math.round(row.within/row.expected*100)):null}));
}
export function searchTimezones(query=''){
 const normalize=s=>String(s).toLocaleLowerCase('ru-RU').replaceAll('ё','е').trim();const q=normalize(query);
 return TIMEZONES.filter(z=>!q||normalize(z.city+' '+z.aliases+' '+z.id).includes(q));
}

// Fresh visitor data; never accepts or copies an owner's workspace.
export function createGuestStore({at=new Date(),timezone='America/New_York',weekdaysOnly=false}={}){
 const w=emptyWorkspace(),local=localNow(timezone,at);
 w.displayName='Посетитель';w.telegram='connected';
 w.settings={...w.settings,timezone,timezoneCity:(timezone==='America/New_York'?'Нью-Йорк':TIMEZONES.find(z=>z.id===timezone)?.city)||'',start:0,end:1440,days:weekdaysOnly?[0,1,2,3,4]:w.settings.days,confirmed:true};
 w.categories.push({id:'cat-6',name:'Творчество',color:COLORS[6],archived:false,productive:true},{id:'cat-7',name:'Еда',color:'#e99a56',archived:false,productive:false});
 w.categories.forEach(c=>{c.productive=['cat-0','cat-1','cat-6'].includes(c.id);});
 w.projects=[{id:'p-1',name:'Редизайн сайта',archived:false},{id:'p-2',name:'Изучение английского',archived:false},{id:'p-3',name:'Личный проект',archived:false}];
 const examples=[
  ['Наметил приоритеты на день','cat-0','p-1'],['Набросал идеи для главной страницы','cat-6','p-1'],
  ['Читал книгу за завтраком','cat-7',''],['Работал над макетом сайта','cat-0','p-1'],
  ['Разбирал новые английские слова','cat-1','p-2'],['Гулял без телефона','cat-2',''],
  ['Созвон с командой по проекту','cat-0','p-1'],['Обед и разговор с другом','cat-5',''],
  ['Смотрел урок по дизайну','cat-1','p-3'],['Тренировка и растяжка','cat-3',''],
  ['Покупки и домашние дела','cat-4',''],['Читал перед сном','cat-2','']
 ];
 const firstMonth=new Date(`${local.date.slice(0,7)}-01T12:00:00Z`);firstMonth.setUTCMonth(firstMonth.getUTCMonth()-11);
 for(let date=firstMonth.toISOString().slice(0,10),d=0;date<=local.date;date=addDays(date,1),d++){
  ensureDay(w,date);w.snapshots[date]={...w.settings,start:480,end:1320};
  const hash=Array.from(date).reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7);
  const weekend=weekday(date)>=5,lateNight=hash%9===0||hash%13===2;
  const wakeMinute=(weekend?570:435)+(hash%5)*15+(lateNight?105:0);
  const wakeAt=instantForLocal(date,clock(wakeMinute),timezone);
  if(hash%11!==0&&wakeAt&&wakeAt<=at)w.dayEvents.push({date,type:'wake',at:wakeAt.toISOString(),timezone});
  const sleepDate=lateNight?addDays(date,1):date;
  const sleepMinute=lateNight?30+(hash%5)*30:1320+(hash%4)*30;
  const sleepAt=instantForLocal(sleepDate,clock(sleepMinute),timezone);
  if(hash%8!==3&&sleepAt&&sleepAt<=at)w.dayEvents.push({date,type:'sleep',at:sleepAt.toISOString(),timezone});
  const currentSlot=Math.floor(local.minute/30)*30;
  const first=date===local.date?Math.min(currentSlot,Math.max(Math.ceil(wakeMinute/30)*30,currentSlot-270)):Math.max(wakeMinute,480+(hash%5)*30);
  const last=date===local.date?currentSlot:960+(hash%9)*30;
  for(let start=first,n=0;start<=last;start+=30,n++){
   // Some days are sparse or empty; gaps are intentional, not inferred activities.
   const chance=((hash^Math.imul(n+1,0x9e3779b1))>>>0)%100;
   const density=date===local.date?60:hash%13===0?0:hash%5===0?23:hash%3===0?43:67;
   if(chance>=density&&!(date===local.date&&(n===0||start===currentSlot)))continue;
   const [text,category,project]=date===local.date&&start<wakeMinute?['Отдыхал перед сном','cat-2','']:examples[(n*5+hash)%examples.length];
   const e={id:`sample-${date}-${n}`,date,start,end:Math.min(start+30,1440),text,category,project,source:n%3===0?'telegram-demo':'site'};
   if(n%8===2){e.activities=[{id:`sample-activity-${date}-${n}-1`,text,at:new Date(`${date}T00:00:00Z`).toISOString()},{id:`sample-activity-${date}-${n}-2`,text:'Сделал короткий перерыв',at:null}];e.text=activityPreview(e.activities);}
   w.entries.push(e);
  }
 }
 return {version:SCHEMA_VERSION,mode:'demo',workspaces:{demo:w,user:emptyWorkspace()}};
}

// Sleep is an elapsed-time calculation, independent of logged activities and DST.
// Attribute it to the date of the wake-up, using the preceding tracking day's bedtime.
export function nightSleepMinutes(workspace,date){
 const wake=workspace.dayEvents?.find(e=>e.date===date&&e.type==='wake');
 const sleep=workspace.dayEvents?.find(e=>e.date===addDays(date,-1)&&e.type==='sleep');
 if(!wake||!sleep)return null;
 const start=Date.parse(sleep.at),end=Date.parse(wake.at);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return null;
 if(workspace.dayEvents.some(e=>e!==sleep&&e!==wake&&Date.parse(e.at)>start&&Date.parse(e.at)<end))return null;
 return Math.round((end-start)/60000);
}

// Build replacements without mutating a journal; persistence/confirmation belongs to the caller.
export function splitIntervalEntries(w,interval,parts,{source='telegram',at=null}={}){
 const {date,start,end}=interval;
 if(!validDate(date)||!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>1440||start>=end)throw new ValidationError('Некорректный интервал.');
 if(!Array.isArray(parts)||parts.length<2||parts.length>60)throw new ValidationError('Укажите от 2 до 60 частей.');
 if(parts.some(p=>!Number.isInteger(p.minutes)||p.minutes<1)||parts.reduce((n,p)=>n+p.minutes,0)!==end-start)throw new ValidationError('Сумма минут должна совпадать с интервалом.');
 const hits=w.entries.filter(e=>e.date===date&&overlap(e,interval));
 if(hits.length>1||hits.some(e=>e.start!==start||e.end!==end))throw new ValidationError('Интервал уже разделён или пересекается с соседней записью.');
 let cursor=start;
 const entries=parts.map(part=>{
  if(part.category&&!w.categories.some(c=>c.id===part.category&&!c.archived))throw new ValidationError('Категория больше недоступна.');
  if(part.project&&!w.projects.some(p=>p.id===part.project&&!p.archived))throw new ValidationError('Проект больше недоступен.');
  const text=typeof part.text==='string'?part.text.trim():'';
  const e={id:uid(),date,start:cursor,end:cursor+part.minutes,text,category:part.category||'',project:part.project||'',source,activities:[{id:uid(),at,text}]};cursor=e.end;return e;
 });
 validateEntries([...w.entries.filter(e=>!hits.includes(e)),...entries],w.categories,w.projects);
 return entries;
}
