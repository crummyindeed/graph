//const level = require("level");
const CrummyDB = require("crummydb");
const path = require("path");

var Locker = function () { };

Locker.prototype.init = async function (dir) {
  //this.db = level(path.join(dir, "events"));
  this.db = new CrummyDB(path.join(dir, "events"));
  await this.db.init();
  var self = this;
  if (await this.db.get("0") == false) {
    await self.db.put(
      "0",
      JSON.stringify({
        in: []
      })
    );
  }

  if (await this.db.get("00") == false) {
    await self.db.put(
      "00",
      JSON.stringify({
        in: []
      })
    );
  }
}

Locker.prototype.get = async function (id) {
  return await this.db.get(id);
};

Locker.prototype.put = async function (id, event, left, right) {
  var exists = await this.db.get(id);
  if (exists != false) {
    return false;  //no duplicates
  }
  var my_left = JSON.parse(await this.get(left));
  var my_right = JSON.parse(await this.get(right));
  my_left.in.push(id);
  my_right.in.push(id);

  await this.db.put(left, JSON.stringify(my_left));
  await this.db.put(right, JSON.stringify(my_right));
  await this.db.put(
    id,
    JSON.stringify({
      event: event,
      left: left,
      right: right,
      in: []
    })
  );
  //I think this will error at all the right times but it's not very grnaular
  return true;
};

Locker.prototype.dflfs = async function ({ from_id, to_id, found_ids, reducer }) {
  if (from_id == "0" || from_id == "00") {
    return found_ids;
  }
  if (typeof found_ids == "undefined") {
    found_ids = [];
  }

  var current_event = await this.get(from_id);

  if (current_event == false) {
    return false;
  }

  current_event = JSON.parse(current_event);

  var left = current_event.left;
  var right = current_event.right;
  if (found_ids.indexOf(left) == -1 && left != to_id) {
    found_ids = await this.dflfs({ from_id: left, to_id, found_ids, reducer });
  }
  if (found_ids.indexOf(right) == -1 && right != to_id) {
    found_ids = await this.dflfs({ from_id: right, to_id, found_ids, reducer });
  }

  if (typeof reducer == "function") {
    reducer(current_event.event);
  }

  found_ids.push(from_id);

  return found_ids;
};

Locker.prototype.getTips = async function (from_id) {
  var current_event = await this.get(from_id);
  if (current_event == false) {
    return false;
  }
  current_event = JSON.parse(current_event);

  var tips = [];

  var incoming = current_event.in;

  if (incoming.length == 0) {
    tips.push(from_id);
  } else {
    for (let i in incoming) {
      var out_tips = await this.getTips(incoming[i]);
      for (let i in out_tips) {
        if (tips.indexOf(out_tips[i]) == -1) {
          tips.push(out_tips[i]);
        }
      }
    }
  }

  return tips;
};

Locker.prototype.getRandomTip = async function (from_id) {
  var current_event = await this.get(from_id);
  if (current_event == false) {
    return false;
  }
  current_event = JSON.parse(current_event);
  var incoming = current_event.in;

  if (incoming.length == 0) {
    return from_id;
  } else {
    var random_out = incoming[Math.floor(Math.random() * incoming.length)];
    return await this.getRandomTip(random_out);
  }
}

module.exports = Locker;
