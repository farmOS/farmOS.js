const { farm, session } = require('./client');

session()
  .then(() => {
    console.time('request');
    return farm.log.get({
      filter: {
        $or: [
          { type: 'activity' },
          { type: 'observation', status: 'done' },
          { status: 'pending' },
        ],
      },
    });
  })
  .then((rs) => { console.log(rs.map(r => r.data)); console.timeEnd('request'); })
  .catch(console.error);
