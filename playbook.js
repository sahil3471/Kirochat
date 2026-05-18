/* Dartmouth playbook — extended to start at 6am.
 * Each entry has a per-day-of-week schedule.
 * dow: 0=Sun, 1=Mon, ..., 6=Sat. Use null for "any day" or list days that match.
 * Hours are in 24h local time.
 */

window.PLAYBOOK = [
  // ===== EARLY MORNING (6am-8am) =====
  {
    start: 6, end: 8, dow: [1,2,3,4,5],
    zone: "Tim Hortons cluster (Wright Ave / Burnside)",
    why: "Commuter coffee + breakfast sandwich orders. Low driver supply, steady pings.",
    detail: "Park near Wright Ave Tim's or the Burnside Dr Tim's. Most orders are short hops within Burnside or to nearby offices. Accept everything under 5km — fast turnover beats waiting for big tips this early."
  },
  {
    start: 6, end: 8, dow: [0, 6],
    zone: "Stay home / sleep in",
    why: "Weekend mornings are dead in Dartmouth. Demand doesn't pick up until ~9–10am.",
    detail: "Saturday and Sunday breakfast is mostly dine-in here. Don't burn gas. If you must work, try the McDonald's on Main St or Cole Harbour Rd around 9am for a few breakfast pings."
  },

  // ===== BREAKFAST PEAK (8-10am) =====
  {
    start: 8, end: 10, dow: [1,2,3,4,5],
    zone: "Burnside (Wright Ave / Akerley) + Dartmouth Crossing edge",
    why: "Office breakfast & coffee runs. McDonald's, Tim's, Starbucks, Subway breakfast.",
    detail: "Stay close to the Wright Ave Tim's / McDonald's strip. If pings dry up, drift toward Dartmouth Crossing's Starbucks / Tim's around the Cineplex parking lot."
  },
  {
    start: 8, end: 10, dow: [0, 6],
    zone: "Cole Harbour Rd / Main St (chains)",
    why: "Weekend breakfast pings start trickling in — McDonald's, Tim's, A&W.",
    detail: "Volume is light. Realistic earnings here are $12–18/hr. If it's slow after 30 min, go offline and start at lunch."
  },

  // ===== MID-MORNING DEAD ZONE (10-11:30am) =====
  {
    start: 10, end: 11.5, dow: null,
    zone: "Reposition or take a break",
    why: "Between breakfast and lunch — pings drop off across all of HRM.",
    detail: "Use this window to grab gas, coffee, or reposition toward Burnside (weekday) or Dartmouth Crossing (weekend). Don't sit idle in a residential area — keep moving along restaurant clusters to refresh your zone position."
  },

  // ===== LUNCH (11:30am-1:30pm) =====
  {
    start: 11.5, end: 13.5, dow: [1,2,3,4,5],
    zone: "Burnside (Wright Ave corridor)",
    why: "Office-worker lunches. Very high ping rate, short trips, strong $/hr.",
    detail: "Park near the Wright Ave Tim's / Subway / Pita Pit block. Most drops are within Burnside Park itself — 5-min trips. Decline anything heading to Sackville or across the bridge."
  },
  {
    start: 11.5, end: 13.5, dow: [0, 6],
    zone: "Dartmouth Crossing",
    why: "Weekend lunch crowd at the chains around Cineplex.",
    detail: "Cactus Club, Five Guys, Mucho Burrito, Boston Pizza. Park between the Brewhouse and Boston Pizza. Sundays especially are busier than people expect."
  },

  // ===== EARLY AFTERNOON DEAD ZONE (1:30-4:30pm) =====
  {
    start: 13.5, end: 16.5, dow: null,
    zone: "Reposition or take a break",
    why: "Dead window everywhere in HRM. Worst $/hr of the day.",
    detail: "Don't fight the market. Eat lunch, do errands, nap. If you must stay online, post up at Dartmouth Crossing and accept only $2/km+ offers — but expect <2 pings/hr."
  },

  // ===== EARLY DINNER (4:30-6pm) =====
  {
    start: 16.5, end: 18, dow: null,
    zone: "Dartmouth Crossing",
    why: "Early dinner pickup, families coming home. Demand ramps fast after 5pm.",
    detail: "Get there before 5. Park near the Brewhouse / Boston Pizza row. This is when stacked orders start appearing — be ready to accept doubles if both drops are in the same direction."
  },

  // ===== PEAK DINNER (6-9pm) =====
  {
    start: 18, end: 21, dow: null,
    zone: "Crossing → Mic Mac → Downtown Dartmouth rotation",
    why: "Peak dinner. Follow the heatmap — surge multipliers and Boost zones rotate every 15–20 min.",
    detail: "Start at Dartmouth Crossing. If the heatmap shifts, drift to Mic Mac Mall, then to Portland St / Alderney Landing. Don't sit in one spot if pings stall for >5 min — reposition. This is your highest-earning window of every day."
  },

  // ===== LATE DINNER WEEKEND (9pm-midnight) =====
  {
    start: 21, end: 24, dow: [4, 5, 6],
    zone: "Downtown Dartmouth + Crossing",
    why: "Late-night fast food, bar food. Drunk-eats premium tippers Thu/Fri/Sat.",
    detail: "Portland St corridor, Battery Park, plus McDonald's / Wendy's / Pizza Hut nearby. Pizza Corner orders sometimes cross from Halifax — decline these unless pay is great (the bridge eats your $/km)."
  },
  {
    start: 21, end: 24, dow: [0, 1, 2, 3],
    zone: "Wind-down — Crossing only, low volume",
    why: "Sun–Wed nights die fast after 9pm.",
    detail: "Realistic earnings drop to $10–15/hr. Most drivers go offline by 10pm. If you stay online, post up at Dartmouth Crossing and only accept $2/km+ orders."
  }
];

// Best earning windows ranked
window.TOP_WINDOWS = [
  { dow: 5, start: 17.5, end: 21.5, label: "Friday 5:30pm – 9:30pm" },
  { dow: 6, start: 17,   end: 22,   label: "Saturday 5:00pm – 10:00pm" },
  { dow: 0, start: 17,   end: 21,   label: "Sunday 5:00pm – 9:00pm" },
  { dow: 5, start: 11.5, end: 13.5, label: "Friday lunch (Burnside)" }
];

// Datalists for the form
window.ZONES = [
  "Burnside",
  "Dartmouth Crossing",
  "Mic Mac",
  "Downtown Dartmouth (Portland St)",
  "Cole Harbour Rd",
  "Main St / Penhorn",
  "Eastern Passage",
  "Halifax (cross-bridge)",
  "Other"
];

window.RESTAURANTS = [
  "McDonald's", "Tim Hortons", "Starbucks", "Subway", "Wendy's", "A&W",
  "Boston Pizza", "Cactus Club", "Moxie's", "The Canadian Brewhouse", "Joey",
  "Five Guys", "Mary Brown's", "Mucho Burrito", "Pita Pit", "KFC", "Pizza Hut",
  "Domino's", "Pizza Pizza", "Freshii", "Freak Lunchbox", "Sushi Shige",
  "The Canteen", "Battery Park", "Brightwood Brewery", "Other"
];
