/*
 * test-cases.js — the questions we promise the bot can handle.
 *
 * Each case says: for this question, the bot should pick these states and
 * answer from these spreadsheet columns. We don't hard-code the answers;
 * we check that the reply contains whatever is in the sheet right now.
 * That way the tests still pass after a reporter updates a deadline.
 *
 * Students: add a case every time a real reader asks something the bot fumbles.
 */
(function (root) {
  var CASES = [
    // The basics: when, how, where
    { q: "When is my mail ballot due in Ohio?", states: ["OH"], columns: ["mail_in_deadline"] },
    { q: "What's the deadline to request an absentee ballot in Pennsylvania?", states: ["PA"], columns: ["request_deadline"] },
    { q: "How do I vote by mail in Georgia?", states: ["GA"], columns: ["request_process", "request_deadline", "id_required"] },
    { q: "Where do I drop off my ballot in California?", states: ["CA"], columns: [] , mustInclude: ["Drop boxes"] },
    { q: "Do I need an ID to vote absentee in Texas?", states: ["TX"], columns: ["id_required"] },
    { q: "Does my ballot need a witness in Wisconsin?", states: ["WI"], columns: ["id_required"] },
    { q: "Do I need an excuse to vote by mail in Missouri?", states: ["MO"], columns: ["request_process"] },

    // Tricky state names
    { q: "When is the ballot due in West Virginia?", states: ["WV"], columns: ["mail_in_deadline"] },
    { q: "When is the ballot due in Virginia?", states: ["VA"], columns: ["mail_in_deadline"] },
    { q: "Ballot deadline Arkansas", states: ["AR"], columns: ["mail_in_deadline"] },
    { q: "What changed in Kansas this year?", states: ["KS"], columns: ["notes_2026"] },
    { q: "Can I vote by mail in Washington DC?", states: ["DC"], columns: ["request_process"] },
    { q: "Can I vote by mail in Washington?", states: ["WA"], columns: ["request_process"] },
    { q: "when's the NC postmark deadline", states: ["NC"], columns: ["mail_in_deadline"] },
    { q: "New York absentee request deadline", states: ["NY"], columns: ["request_deadline"] },
    { q: "Is there a grace period for late ballots in Idaho?", states: ["ID"], columns: ["mail_in_deadline"] },

    // Two states at once
    { q: "Compare return deadlines for Utah and Nevada", states: ["UT", "NV"], columns: ["mail_in_deadline"] },

    // Words that look like state codes but aren't
    { q: "OK so how do I get a ballot in Iowa?", states: ["IA"], columns: ["request_deadline"] },
    { q: "Do I need an ID in Michigan", states: ["MI"], columns: ["id_required"] },

    // No state given: the bot should ask, not guess
    { q: "When is my ballot due?", states: [], expectType: "need_state" },
    { q: "hello", states: [], expectType: "help" }
  ];

  // A follow-up conversation: the bot should remember the last state
  var FOLLOW_UP = [
    { q: "How do I vote by mail in Florida?", states: ["FL"] },
    { q: "And what about ID?", states: ["FL"], columns: ["id_required"] }
  ];

  var api = { CASES: CASES, FOLLOW_UP: FOLLOW_UP };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MailBotTests = api;
})(this);
