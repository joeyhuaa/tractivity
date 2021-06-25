'use strict'

// using a Promises-wrapped version of sqlite3
const db = require('./sqlWrap');

// SQL commands for ActivityTable
const insertDB = "insert into ActivityTable (activity, date, amount, userid) values (?,?,?,?)"
const getOneDB = "select * from ActivityTable where activity = ? and date = ? and amount = ?";
const allDB = "select * from ActivityTable where activity = ?";
const futureDB = "select * from ActivityTable where amount = -1 and userid = ?"
const getPastWeekByActivityDB = "SELECT * FROM ActivityTable WHERE activity = ? and date BETWEEN ? and ? and userid = ?";
const getMostRecentDB = "SELECT MAX(rowIdNum), activity, date, amount FROM ActivityTable";

// insert
async function insert(activity, date, amount, userid) {
  console.log(date)
  let result = await db.run(insertDB, [activity, date, amount, userid])
  return result
}

// retrieve all planned
async function retrievePlanned(userid) {
  let result = await db.all(futureDB, [userid])
  return result
}

// retrieve all past
async function retrievePast() {
  let cmd = "select * from ActivityTable"
  let result = await db.all(cmd)
  return result
}

// retrieve all past with activity match
async function retrievePastActs(activity) {
  let result = await db.all(allDB, [activity])
  return result
}

// delete older planned activities
// today is in 'yyyy-mm-dd'
async function deleteOlderPlanned(today, userid) {
  let cmd = `delete from ActivityTable where amount = -1 and date < ${today} and userid=${userid}`
  await db.run(cmd)
}

async function deleteOne(rowIdNum, userid) {
  let cmd = `delete from ActivityTable where rowIdNum = ? and userid = ?`
  await db.run(cmd, [rowIdNum, userid])
}

async function insertUser(userid, firstname) {
  // first try pulling the user to see if it exists in db
  let cmd = "select * from ProfileTable where userid = ? and firstname = ?"
  let res = await db.all(cmd, [userid, firstname])
  console.log('GET USER', res)

  // then insert
  if (res.length == 0) {
    let cmd2 = "insert into ProfileTable (userid, firstname) values (?,?)"
    await db.run(cmd2, [userid, firstname])
  }
}

async function getUser(userid) {
  console.log('USERID', userid)

  let cmd = "select * from ProfileTable where userid = ?"

  try {
    let result = await db.all(cmd, [userid])
    return result
  }
  catch (err) {
    console.log(err)
    return []
  }
}

async function emptyDB() {
  // empty out database - probably you don't want to do this in your program
  await db.deleteEverything();
}

async function get_similar_activities_in_range(activityType, min, max, userid) {
  console.log('userid', userid)
  console.log(activityType, min, max)
  
  try {
    let results = await db.all(
      getPastWeekByActivityDB, [activityType, min, max, userid]
    );
    return results;
  }
  catch (error) {
    console.log(error);
    return [];
  }
}

/**
 * Get the most recently inserted activity in the database
 * @returns {Activity} activity 
 * @returns {string} activity.activity - type of activity
 * @returns {number} activity.date - ms since 1970
 * @returns {float} activity.scalar - measure of activity conducted
 */
async function get_most_recent_entry() {
  try {
    let result = await db.get(getMostRecentDB, []);
    return (result['MAX(rowIdNum)'] != null) ? result : null;
  }
  catch (error) {
    console.log(error);
    return null;
  }
}

module.exports.emptyDB = emptyDB;
module.exports.insert = insert;
module.exports.retrievePlanned = retrievePlanned;
module.exports.retrievePast = retrievePast;
module.exports.retrievePastActs = retrievePastActs;
module.exports.deleteOlderPlanned = deleteOlderPlanned;
module.exports.deleteOne = deleteOne;
module.exports.insertUser = insertUser;
module.exports.getUser = getUser;
module.exports.get_most_recent_entry = get_most_recent_entry;
module.exports.get_similar_activities_in_range = get_similar_activities_in_range;