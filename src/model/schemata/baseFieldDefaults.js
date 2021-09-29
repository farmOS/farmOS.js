export default {
  log: {
    attributes: {
      name: '',
      timestamp: new Date().toISOString(),
      status: 'pending',
      flag: [],
      geometry: null,
      notes: null,
      data: null,
      is_movement: false,
    },
    relationships: {
      asset: [],
      quantity: [],
      owner: [],
      category: [],
      location: [],
      image: [],
      file: [],
    },
  },
  asset: {
    attributes: {
      name: '',
      status: 'active',
      flag: [],
      geometry: null,
      notes: null,
      data: null,
      intrinsic_geometry: null,
      is_location: false,
      is_fixed: false,
      id_tag: [],
    },
    relationships: {
      parent: [],
      location: [],
      image: [],
      file: [],
    },
  },
  taxonomy_term: {
    attributes: {
      name: '',
      description: {},
      weight: 0,
    },
    relationships: {
      parent: [],
    },
  },
  user: {
    attributes: {
      name: '',
      display_name: '',
      mail: '',
      langcode: 'en',
    },
    relationships: {
      roles: [],
    },
  },
  // TODO: Double-check plan defaults.
  plan: {
    attributes: {
      name: '',
      status: 'active',
      flag: [],
      notes: null,
      data: null,
    },
    relationships: {
      image: [],
      file: [],
    },
  },
  // TODO: Double-check quantity defaults.
  quantity: {
    attributes: {
      measure: {},
      value: 0,
      label: '',
    },
    relationships: {
      unit: {},
    },
  },
};
