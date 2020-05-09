const expect = require("chai").expect;
const Locker = require(".");
const rimraf = require("rimraf");

rimraf.sync("./test_db");

//scaffolding
var store = new Locker();
var event = "my_body";
var id = "my_id";
var left = "0";
var right = "00";
var encoded = JSON.stringify({
  event: event,
  left: left,
  right: right,
  in: []
});

describe("start", function () {
  it("should not die?", async function () {
    await store.init("./test_db");
  });
});

describe("put(id, event, left, right)", function () {
  it("should insert an event into the store", async function () {
    var inserted = await store.put(id, event, left, right);
    expect(inserted).to.be.true;
    var saved = await store.get(id);
    expect(saved).to.equal(encoded);
  });

  it("should ignore duplicates", async function () {
    var inserted = await store.put(id, "different", left, right);
    expect(inserted).to.be.false;
    var saved = await store.get(id);
    expect(saved).to.equal(encoded);
  });

  it("should update the in property of it's dependencies", async function () {
    var left_ev = JSON.parse(await store.get(left));
    var right_ev = JSON.parse(await store.get(right));
    expect(left_ev.in.indexOf(id)).to.be.greaterThan(-1);
    expect(right_ev.in.indexOf(id)).to.be.greaterThan(-1);
  });
});

describe("get(id)", function () {
  it("should return false for a non-existant event", async function () {
    var exists = await store.get("bad key");
    expect(exists).to.be.false;
  });
  it("should return an existing event", async function () {
    var existing = await store.get(id);
    expect(existing).to.equal(encoded);
  });
});

describe("dflfs({from_id [, to_id] [, found_ids] [, reducer]})", function () {
  it("should return a reverse topological sort of event ids confirmed by a start id, including the start and exluding 0 and 00", async function () {
    await store.put("another_id", "another_body", "my_id", "0");
    await store.put("third_id", "third_body", "my_id", "another_id");

    var confirmed = await store.dflfs({ from_id: id });
    expect(JSON.stringify(confirmed)).to.equal(JSON.stringify(["my_id"]));

    var confirmed2 = await store.dflfs({ from_id: "another_id" });
    expect(JSON.stringify(confirmed2)).to.equal(
      JSON.stringify(["my_id", "another_id"])
    );

    var confirmed3 = await store.dflfs({ from_id: "third_id" });
    expect(JSON.stringify(confirmed3)).to.equal(
      JSON.stringify(["my_id", "another_id", "third_id"])
    );
  });

  it("should always do left first and depth first", async function () {
    await store.put("side_id", "side_body", "00", "0");
    await store.put("side_id2", "side_body2", "side_id", id);

    var confirmed = await store.dflfs({ from_id: "side_id2" });
    expect(JSON.stringify(confirmed)).to.equal(
      JSON.stringify(["side_id", "my_id", "side_id2"])
    );
  });

  it("should accept a callback and sent it events in order", async function () {
    var log = [];
    var reducer = function (event) {
      log.push(event);
    };
    //this relies on stuff set up in previous test...
    //that's probably bad
    await store.dflfs({ from_id: "third_id", found_ids: [], reducer: reducer });
    expect(JSON.stringify(log)).to.equal(
      JSON.stringify(["my_body", "another_body", "third_body"])
    );
  });

  it("should support stopping search when encountering an optional to_id", async function () {
    var confirmed4 = await store.dflfs({ from_id: "third_id", to_id: "my_id" });
    expect(JSON.stringify(confirmed4)).to.equal(
      JSON.stringify(["another_id", "third_id"])
    );
  });
});

describe("getTips(from_id)", function () {
  it("should follow incoming edges outward to find unconfirmed events that confirm the from_id", async function () {
    //this also relies on stuff set up in previous test...
    //that's probably bad
    var tips = await store.getTips(id);
    expect(JSON.stringify(tips)).to.equal(JSON.stringify(["third_id", "side_id2"]));
  });
});

describe("getRandomTip(from_id)", function () {
  it("should follow incoming edges outward, randomly, to find an unconfirmed event that confirm the from_id", async function () {
    //this also relies on stuff set up in previous test...
    //that's probably bad
    var tip = await store.getRandomTip(id);
    expect(tip == "third_id" || tip == "side_id2").to.be.true;
  });
});