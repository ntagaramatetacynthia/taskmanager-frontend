// All 30 districts of Rwanda (static — no API call needed)
export const RWANDA_DISTRICTS = [
  // Kigali City
  { id: 1,  name: 'Gasabo',       code: 'GSB', province: 'Kigali City'       },
  { id: 2,  name: 'Kicukiro',     code: 'KCK', province: 'Kigali City'       },
  { id: 3,  name: 'Nyarugenge',   code: 'NYR', province: 'Kigali City'       },
  // Eastern Province
  { id: 4,  name: 'Bugesera',     code: 'BGS', province: 'Eastern Province'  },
  { id: 5,  name: 'Gatsibo',      code: 'GTS', province: 'Eastern Province'  },
  { id: 6,  name: 'Kayonza',      code: 'KYZ', province: 'Eastern Province'  },
  { id: 7,  name: 'Kirehe',       code: 'KRH', province: 'Eastern Province'  },
  { id: 8,  name: 'Ngoma',        code: 'NGM', province: 'Eastern Province'  },
  { id: 9,  name: 'Nyagatare',    code: 'NYG', province: 'Eastern Province'  },
  { id: 10, name: 'Rwamagana',    code: 'RWM', province: 'Eastern Province'  },
  // Northern Province
  { id: 11, name: 'Burera',       code: 'BUR', province: 'Northern Province' },
  { id: 12, name: 'Gakenke',      code: 'GKK', province: 'Northern Province' },
  { id: 13, name: 'Gicumbi',      code: 'GCM', province: 'Northern Province' },
  { id: 14, name: 'Musanze',      code: 'MSZ', province: 'Northern Province' },
  { id: 15, name: 'Rulindo',      code: 'RLD', province: 'Northern Province' },
  // Southern Province
  { id: 16, name: 'Gisagara',     code: 'GSG', province: 'Southern Province' },
  { id: 17, name: 'Huye',         code: 'HUY', province: 'Southern Province' },
  { id: 18, name: 'Kamonyi',      code: 'KMN', province: 'Southern Province' },
  { id: 19, name: 'Muhanga',      code: 'MHG', province: 'Southern Province' },
  { id: 20, name: 'Nyamagabe',    code: 'NYM', province: 'Southern Province' },
  { id: 21, name: 'Nyamasheke',   code: 'NYS', province: 'Southern Province' },
  { id: 22, name: 'Nyanza',       code: 'NYZ', province: 'Southern Province' },
  { id: 23, name: 'Nyaruguru',    code: 'NYU', province: 'Southern Province' },
  { id: 24, name: 'Ruhango',      code: 'RHG', province: 'Southern Province' },
// Western Province
  { id: 25, name: 'Karongi',    code: 'KRG', province: 'Western Province'  },
  { id: 26, name: 'Ngororero',  code: 'NGR', province: 'Western Province'  },
  { id: 27, name: 'Nyabihu',    code: 'NYB', province: 'Western Province'  },
  { id: 28, name: 'Rubavu',     code: 'RBV', province: 'Western Province'  },
  { id: 29, name: 'Rusizi',     code: 'RSZ', province: 'Western Province'  },
  { id: 30, name: 'Rutsiro',    code: 'RTS', province: 'Western Province'  },
]

// Group districts by province for grouped <optgroup> rendering
export const DISTRICTS_BY_PROVINCE = RWANDA_DISTRICTS.reduce((acc, d) => {
  if (!acc[d.province]) acc[d.province] = []
  acc[d.province].push(d)
  return acc
}, {})
