const { BigNumber } = require('ethers');
const BN = BigNumber.from;

exports.centerTime = (time) => {
  const now = parseInt(time || new Date().getTime() / 1000);

  const delta1s = 1;
  const delta1m = 1 * 60;
  const delta1h = 1 * 60 * 60;
  const delta1d = 24 * 60 * 60;

  var times = { now: BN(now) };

  for (let i = 0; i < 60; i++) {
    times[`delta${i}s`] = BN(i * delta1s);
    times[`delta${i}m`] = BN(i * delta1m);
    times[`delta${i}h`] = BN(i * delta1h);
    times[`delta${i}d`] = BN(i * delta1d);
    times[`delta${i}y`] = BN(i * 365 * delta1d);
    times[`future${i}s`] = BN(now + i * delta1s);
    times[`future${i}m`] = BN(now + i * delta1m);
    times[`future${i}h`] = BN(now + i * delta1h);
    times[`future${i}d`] = BN(now + i * delta1d);
    times[`future${i}y`] = BN(now + i * 365 * delta1d);
  }

  times.future = (t) => {
    return times.now.add(t);
  };

  return times;
};
