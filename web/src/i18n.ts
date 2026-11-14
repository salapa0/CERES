export type Lang = 'th' | 'en';

const TH = {
  'app.subtitle': 'ไทม์แมชชีนแปลงนา',
  'app.tagline': 'หลังเกี่ยวข้าว ปลูกอะไรต่อดี? แตะที่นาของคุณบนแผนที่',
  'app.loading': 'กำลังโหลดข้อมูล NASA…',
  'app.loadingLive': 'กำลังดึงข้อมูลสดจาก NASA POWER (อาจใช้เวลาสักครู่)…',
  'app.outside': 'ตอนนี้รองรับเฉพาะพื้นที่ในประเทศไทย',
  'app.error': 'โหลดข้อมูลไม่สำเร็จ ลองอีกครั้ง',
  'app.disclaimer': 'เครื่องมือนี้ช่วยประกอบการตัดสินใจ ไม่ได้แทนความรู้ของเกษตรกรหรือเจ้าหน้าที่เกษตร ไม่เกี่ยวข้องกับหรือรับรองโดย NASA',
  'field.title': 'แปลงของคุณ',
  'field.cellNote': 'ข้อมูลเป็นค่าเฉลี่ยของพื้นที่กว้างราว 55 กม.',
  'input.sow': 'วันปลูก',
  'input.soil': 'ดินของคุณ',
  'input.position': 'ลักษณะนา',
  'soil.sand': 'ดินทราย', 'soil.loamySand': 'ดินทรายปนร่วน', 'soil.sandyLoam': 'ดินร่วนปนทราย',
  'soil.loam': 'ดินร่วน', 'soil.clayLoam': 'ดินร่วนเหนียว',
  'position.lowland': 'นาลุ่ม (น้ำใต้ดินตื้น)', 'position.upland': 'นาดอน',
  'card.A': 'ทำแบบเดิม', 'card.B': 'ปลูกพืชตระกูลถั่ว', 'card.C': 'ปลูกพืชอื่น',
  'card.A.crop': 'ข้าว → ปล่อยนาว่าง',
  'card.A.body': 'ไม่เสี่ยงขาดทุน แต่ไม่มีรายได้ฤดูแล้ง',
  'card.odds': 'รอด {good} จาก {total} ฤดู',
  'card.detail': 'ได้ผลน้อย {poor} · ไม่รอด {failed}',
  'card.noData': 'ข้อมูลไม่พอ',
  'card.alt': 'ทางเลือกใกล้เคียง: {name}',
  'card.estimate': 'ค่าพืชบางส่วนเป็นค่าประมาณ',
  'card.confidence': 'ความมั่นใจ',
  'card.blind': 'สิ่งที่ข้อมูลมองไม่เห็น',
  'card.blind.1': 'ข้อมูลเป็นค่าเฉลี่ยพื้นที่กว้าง แปลงของคุณอาจต่างออกไป',
  'card.blind.2': 'ชนิดดินและลักษณะนามาจากที่คุณเลือก ไม่ได้วัดจริง',
  'card.blind.3': 'ไม่ได้คิดเรื่องโรค แมลง ราคา และแรงงาน',
  'card.ask': 'ควรถามเจ้าหน้าที่เกษตร: พันธุ์ที่เหมาะกับพื้นที่ และมีตลาดรับซื้อหรือไม่',
  'effect.nitrogen': 'เพิ่มไนโตรเจนให้ดิน', 'effect.organic': 'เพิ่มอินทรียวัตถุและไนโตรเจน (ไถกลบ)',
  'effect.uses': 'ใช้ธาตุอาหารจากดิน', 'effect.bare': 'ดินว่าง ไม่มีพืชคลุม',
  'badge.medium': 'กลาง', 'badge.low': 'ต่ำ',
  'badge.why.medium': 'ยังไม่ได้เทียบกับข้อมูลดาวเทียม', 'badge.why.low': 'มีข้อมูลน้อยกว่า 15 ฤดู',
  'timeline.title': 'ไทม์แมชชีน: ถ้าปลูกในปีที่ผ่านมา',
  'timeline.hint': 'แตะที่ปีเพื่อดูรายละเอียด',
  'legend': '🌱 รอด · 🍂 ได้ผลน้อย · ✖ ไม่รอด · · ไม่มีข้อมูล',
  'outcome.good': 'รอด', 'outcome.poor': 'ได้ผลน้อย', 'outcome.failed': 'ไม่รอด', 'outcome.nodata': 'ไม่มีข้อมูล',
  'drawer.season': 'ฤดู {season}',
  'drawer.died': 'น่าจะตายราว {date}: {reason}',
  'drawer.failedNoDay': 'ได้น้ำไม่ถึงครึ่งของที่พืชต้องการ',
  'drawer.ret': 'ได้น้ำ {pct}% ของที่พืชต้องการ',
  'drawer.sown': 'ปลูก {date}',
  'drawer.chart': 'น้ำที่พืชใช้ได้ในดิน (มม.) · เส้นประ = เริ่มขาดน้ำ · แท่งฟ้า = ฝน',
  'drawer.close': 'ปิด',
  'reason.drought': 'ดินแห้งจนพืชขาดน้ำ', 'reason.heat': 'ร้อนจัดช่วงออกดอก',
  'sources.title': 'ข้อมูลจาก',
  'sources.method': 'วิธีคำนวณ: สมดุลน้ำในดิน FAO-56 (ค่าเริ่มต้นยังไม่ได้ปรับเทียบกับแปลงจริง)',
};

const EN: Record<keyof typeof TH, string> = {
  'app.subtitle': 'Field Time Machine',
  'app.tagline': 'What to plant after the rice harvest? Tap your field on the map',
  'app.loading': 'Loading NASA data…',
  'app.loadingLive': 'Fetching live data from NASA POWER (this can take a moment)…',
  'app.outside': 'Only locations in Thailand are supported for now',
  'app.error': 'Could not load data. Please try again',
  'app.disclaimer': 'This tool supports decisions; it does not replace farmer or extension-officer judgement. Not affiliated with or endorsed by NASA',
  'field.title': 'Your field',
  'field.cellNote': 'Data is an average over an area about 55 km wide.',
  'input.sow': 'Sowing date',
  'input.soil': 'Your soil',
  'input.position': 'Field type',
  'soil.sand': 'Sand', 'soil.loamySand': 'Loamy sand', 'soil.sandyLoam': 'Sandy loam',
  'soil.loam': 'Loam', 'soil.clayLoam': 'Clay loam',
  'position.lowland': 'Lowland paddy (shallow groundwater)', 'position.upland': 'Upland',
  'card.A': 'Keep as today', 'card.B': 'Plant a legume', 'card.C': 'Plant another crop',
  'card.A.crop': 'Rice → bare field',
  'card.A.body': 'No risk of loss, but no dry-season income',
  'card.odds': 'Survived {good} of {total} seasons',
  'card.detail': 'Poor {poor} · Failed {failed}',
  'card.noData': 'Not enough data',
  'card.alt': 'Close alternative: {name}',
  'card.estimate': 'Some crop values are estimates',
  'card.confidence': 'Confidence',
  'card.blind': 'What the data cannot see',
  'card.blind.1': 'Data is a wide-area average; your field may differ',
  'card.blind.2': 'Soil and field type come from your choice, not a measurement',
  'card.blind.3': 'Pests, disease, prices and labour are not modelled',
  'card.ask': 'Ask your extension officer: which variety suits the area, and is there a buyer?',
  'effect.nitrogen': 'Adds nitrogen to the soil', 'effect.organic': 'Adds organic matter and nitrogen (ploughed in)',
  'effect.uses': 'Uses soil nutrients', 'effect.bare': 'Soil left bare, no cover',
  'badge.medium': 'Medium', 'badge.low': 'Low',
  'badge.why.medium': 'Not yet checked against satellite data', 'badge.why.low': 'Fewer than 15 seasons of data',
  'timeline.title': 'Time machine: if you had planted in past years',
  'timeline.hint': 'Tap a year for details',
  'legend': '🌱 survived · 🍂 poor · ✖ failed · · no data',
  'outcome.good': 'Survived', 'outcome.poor': 'Poor', 'outcome.failed': 'Failed', 'outcome.nodata': 'No data',
  'drawer.season': 'Season {season}',
  'drawer.died': 'Would have died around {date}: {reason}',
  'drawer.failedNoDay': 'Got less than half the water the crop needs',
  'drawer.ret': 'Got {pct}% of the water the crop needs',
  'drawer.sown': 'Sown {date}',
  'drawer.chart': 'Plant-available soil water (mm) · dashed = stress begins · blue bars = rain',
  'drawer.close': 'Close',
  'reason.drought': 'soil dried out and the crop ran out of water', 'reason.heat': 'extreme heat at flowering',
  'sources.title': 'Data from',
  'sources.method': 'Method: FAO-56 soil water balance (starting values, not yet calibrated against real fields)',
};

export type Key = keyof typeof TH;

export function t(lang: Lang, key: Key, vars: Record<string, string | number> = {}): string {
  return (lang === 'th' ? TH : EN)[key].replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BE = 543; // Buddhist Era offset used in Thailand

/** Season 2015 → '2558/59' (Thai) or '2015/16' (English). */
export function formatSeason(year: number, lang: Lang): string {
  const y = lang === 'th' ? year + BE : year;
  return `${y}/${String((y + 1) % 100).padStart(2, '0')}`;
}

export function formatDate(d: Date, lang: Lang): string {
  const months = lang === 'th' ? TH_MONTHS : EN_MONTHS;
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear() + (lang === 'th' ? BE : 0)}`;
}

export function formatMonthDay(monthDay: string, lang: Lang): string {
  const [m, d] = monthDay.split('-').map(Number);
  return `${d} ${(lang === 'th' ? TH_MONTHS : EN_MONTHS)[m - 1]}`;
}
