window.ZeekeLookups = (() => {
  const COUNTRIES = [
    'Malaysia', 'Worldwide', 'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola',
    'Antigua and Barbuda', 'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan',
    'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize',
    'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil',
    'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon', 'Canada',
    'Cape Verde', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia',
    'Comoros', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic',
    'Democratic Republic of the Congo', 'Denmark', 'Djibouti', 'Dominica',
    'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea',
    'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Fiji', 'Finland', 'France',
    'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada',
    'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras',
    'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel',
    'Italy', 'Ivory Coast', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya',
    'Kiribati', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho',
    'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar',
    'Malawi', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania',
    'Mauritius', 'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia',
    'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nauru', 'Nepal',
    'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea',
    'North Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama',
    'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal',
    'Qatar', 'Republic of the Congo', 'Romania', 'Russia', 'Rwanda',
    'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines',
    'Samoa', 'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal',
    'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia',
    'Solomon Islands', 'Somalia', 'South Africa', 'South Korea', 'South Sudan',
    'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria',
    'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga',
    'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda',
    'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay',
    'Uzbekistan', 'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam', 'Yemen',
    'Zambia', 'Zimbabwe',
  ];

  const MALAYSIA_STATES = [
    'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang',
    'Pulau Pinang', 'Perak', 'Perlis', 'Sabah', 'Sarawak', 'Selangor',
    'Terengganu', 'Wilayah Persekutuan Kuala Lumpur', 'Wilayah Persekutuan Labuan',
    'Wilayah Persekutuan Putrajaya',
  ];

  const POSTCODES = [
    ['01000', 'Kangar', 'Perlis'], ['02000', 'Kuala Perlis', 'Perlis'],
    ['05000', 'Alor Setar', 'Kedah'], ['08000', 'Sungai Petani', 'Kedah'],
    ['10000', 'George Town', 'Pulau Pinang'], ['11900', 'Bayan Lepas', 'Pulau Pinang'],
    ['15000', 'Kota Bharu', 'Kelantan'], ['18500', 'Machang', 'Kelantan'],
    ['20000', 'Kuala Terengganu', 'Terengganu'], ['24000', 'Chukai', 'Terengganu'],
    ['25000', 'Kuantan', 'Pahang'], ['28000', 'Temerloh', 'Pahang'],
    ['30000', 'Ipoh', 'Perak'], ['34000', 'Taiping', 'Perak'],
    ['40000', 'Shah Alam', 'Selangor'], ['43000', 'Kajang', 'Selangor'],
    ['47000', 'Sungai Buloh', 'Selangor'], ['50000', 'Kuala Lumpur', 'Wilayah Persekutuan Kuala Lumpur'],
    ['50450', 'Kuala Lumpur', 'Wilayah Persekutuan Kuala Lumpur'], ['55100', 'Kuala Lumpur', 'Wilayah Persekutuan Kuala Lumpur'],
    ['62000', 'Putrajaya', 'Wilayah Persekutuan Putrajaya'], ['63000', 'Cyberjaya', 'Selangor'],
    ['70000', 'Seremban', 'Negeri Sembilan'], ['75000', 'Melaka', 'Melaka'],
    ['80000', 'Johor Bahru', 'Johor'], ['83000', 'Batu Pahat', 'Johor'],
    ['87000', 'Labuan', 'Wilayah Persekutuan Labuan'], ['88000', 'Kota Kinabalu', 'Sabah'],
    ['90000', 'Sandakan', 'Sabah'], ['93000', 'Kuching', 'Sarawak'],
    ['96000', 'Sibu', 'Sarawak'], ['98000', 'Miri', 'Sarawak'],
  ];

  const STATE_PREFIXES = {
    Johor: ['79', '80', '81', '82', '83', '84', '85', '86'],
    Kedah: ['05', '06', '07', '08', '09'],
    Kelantan: ['15', '16', '17', '18'],
    Melaka: ['75', '76', '77', '78'],
    'Negeri Sembilan': ['70', '71', '72', '73'],
    Pahang: ['25', '26', '27', '28', '39', '49', '69'],
    'Pulau Pinang': ['10', '11', '12', '13', '14'],
    Perak: ['30', '31', '32', '33', '34', '35', '36', '39'],
    Perlis: ['01', '02'],
    Sabah: ['88', '89', '90', '91'],
    Sarawak: ['93', '94', '95', '96', '97', '98'],
    Selangor: ['40', '41', '42', '43', '44', '45', '46', '47', '48', '63', '64', '68'],
    Terengganu: ['20', '21', '22', '23', '24'],
    'Wilayah Persekutuan Kuala Lumpur': ['50', '51', '52', '53', '54', '55', '56', '57', '58', '59', '60'],
    'Wilayah Persekutuan Labuan': ['87'],
    'Wilayah Persekutuan Putrajaya': ['62'],
  };

  const institutionCache = new Map();
  const locationCache = new Map();

  function debounce(fn, wait = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  function postcodeOptions(state = '') {
    return POSTCODES
      .filter(row => !state || row[2] === state)
      .map(([postcode, town, stateName]) => ({ postcode, town, state: stateName }));
  }

  function cityOptions(state = '') {
    const seen = new Set();
    return postcodeOptions(state).filter((item) => {
      const key = `${item.town}|${item.state}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function regionOptions(country = 'Malaysia', currentLocation = '') {
    const current = String(currentLocation || '').trim();
    const currentLower = current.toLowerCase();
    if (country === 'Malaysia') {
      const firstPart = currentLower.split(',')[0].trim();
      const selected = MALAYSIA_STATES.find((state) => {
        const stateLower = state.toLowerCase();
        return currentLower.includes(stateLower) || (firstPart && stateLower.includes(firstPart));
      }) || (currentLower === 'remote' ? 'Remote' : '');
      return [
        { value: '', label: 'Select state', selected: !selected },
        ...MALAYSIA_STATES.map(state => ({ value: state, label: state, selected: state === selected })),
        { value: 'Remote', label: 'Remote', selected: selected === 'Remote' },
      ];
    }

    const hasLegacyLocation = current && currentLower !== 'remote' && currentLower !== country.toLowerCase();
    return [
      { value: '', label: `Use ${country || 'country'} only`, selected: !hasLegacyLocation && currentLower !== 'remote' },
      ...(hasLegacyLocation ? [{ value: current, label: current, selected: true }] : []),
      { value: 'Remote', label: 'Remote', selected: currentLower === 'remote' },
    ];
  }

  function formatLocation(country = '', region = '') {
    if (region === 'Remote') return 'Remote';
    return [region, country].filter(Boolean).join(', ');
  }

  function validateMalaysiaPostcode(postcode, state) {
    const digits = String(postcode || '').replace(/\D/g, '');
    if (!digits) return { ok: true, postcode: '' };
    if (!/^\d{5}$/.test(digits)) return { ok: false, postcode: digits };
    const prefixes = STATE_PREFIXES[state] || [];
    return { ok: !prefixes.length || prefixes.includes(digits.slice(0, 2)), postcode: digits };
  }

  function formatPhone(value, country = 'Malaysia') {
    let raw = String(value || '').trim().replace(/[^\d+]/g, '');
    if (!raw) return '';
    if (raw.startsWith('00')) raw = `+${raw.slice(2)}`;

    const digits = raw.replace(/\D/g, '');
    if (country === 'Malaysia') {
      if (raw.startsWith('+') || digits.startsWith('60')) {
        const local = digits.startsWith('60') ? digits.slice(2) : digits;
        if (local.startsWith('11') && local.length >= 10) return `+60 ${local.slice(0, 2)}-${local.slice(2, 6)} ${local.slice(6, 10)}`.trim();
        if (local.startsWith('1') && local.length >= 9) return `+60 ${local.slice(0, 2)}-${local.slice(2, 5)} ${local.slice(5, 9)}`.trim();
        if (local.startsWith('3') && local.length >= 8) return `+60 ${local.slice(0, 1)}-${local.slice(1, 5)} ${local.slice(5, 9)}`.trim();
        return `+60 ${local.replace(/(\d{2,4})(?=\d)/g, '$1 ').trim()}`;
      }
      if (digits.startsWith('011') && digits.length >= 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)} ${digits.slice(7, 11)}`;
      if (digits.startsWith('01') && digits.length >= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
      if (digits.startsWith('03') && digits.length >= 10) return `${digits.slice(0, 2)}-${digits.slice(2, 6)} ${digits.slice(6, 10)}`;
      if (digits.startsWith('0') && digits.length >= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)} ${digits.slice(5)}`;
    }

    if (raw.startsWith('+')) {
      return `+${digits.slice(0, 3)} ${digits.slice(3).replace(/(\d{3})(?=\d)/g, '$1 ').trim()}`.trim();
    }
    if (country === 'United States' && digits.length === 10) {
      return `+1 ${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
  }

  function validatePhone(value, country = 'Malaysia') {
    const raw = String(value || '').trim();
    if (!raw) return { ok: true, message: '' };
    if (!/^[+\d\s().-]+$/.test(raw)) {
      return { ok: false, message: 'Use numbers and standard phone symbols only.' };
    }
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
      return { ok: false, message: 'Enter a valid phone number with 7 to 15 digits.' };
    }
    if (country === 'Malaysia') {
      const local = digits.startsWith('60') ? `0${digits.slice(2)}` : digits;
      if (!/^0(?:1\d{8,9}|[2-9]\d{7,8})$/.test(local)) {
        return { ok: false, message: 'Enter a valid Malaysian mobile or landline number.' };
      }
    }
    return { ok: true, message: '' };
  }

  async function searchInstitutions(query, country = 'Malaysia') {
    const q = String(query || '').trim();
    if (q.length < 2) return [];
    const key = `${country}:${q}`.toLowerCase();
    if (institutionCache.has(key)) return institutionCache.get(key);

    try {
      const res = await fetch(`/api/lookups/institutions?q=${encodeURIComponent(q)}&country=${encodeURIComponent(country)}`, {
        credentials: 'same-origin',
      });
      const data = await res.json();
      const results = data.success && Array.isArray(data.results) ? data.results : [];
      institutionCache.set(key, results);
      return results;
    } catch (err) {
      return [];
    }
  }

  async function searchLocations(query, country = 'Worldwide') {
    const q = String(query || '').trim();
    if (q.length < 2) return [];
    const key = `${country}:${q}`.toLowerCase();
    if (locationCache.has(key)) return locationCache.get(key);

    try {
      const res = await fetch(`/api/lookups/locations?q=${encodeURIComponent(q)}&country=${encodeURIComponent(country || 'Worldwide')}`, {
        credentials: 'same-origin',
      });
      const data = await res.json();
      const results = data.success && Array.isArray(data.results) ? data.results : [];
      locationCache.set(key, results);
      return results;
    } catch (err) {
      return [];
    }
  }

  return {
    COUNTRIES,
    MALAYSIA_STATES,
    postcodeOptions,
    cityOptions,
    regionOptions,
    formatLocation,
    validateMalaysiaPostcode,
    formatPhone,
    validatePhone,
    searchInstitutions,
    searchLocations,
    debounce,
  };
})();
