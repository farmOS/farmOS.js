const schemata = {
  log: {
    activity: {},
    observation: {},
    input: {},
    harvest: {},
    lab_test: {},
    maintenance: {},
    medical: {},
    purchase: {},
    sale: {},
    seeding: {},
    transplanting: {},
  },
  asset: {
    land: {},
    plant: {},
    animal: {},
    equipment: {},
    compost: {},
    structure: {},
    sensor: {},
    water: {},
    group: {},
  },
  term: {
    animal_type: {},
    log_category: {},
    material: {},
    plant_type: {},
    season: {},
    unit: {},
  },
  user: {
    user: {},
  },
  plan: {},
  quantity: {
    standard: {},
  },
};

module.exports = schemata;
