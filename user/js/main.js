import data from './data.js'
import barchart from './barchart.js'

/* barchart */
barchart.init('chart-anchor', 500, 300);
barchart.render(data, 'Kilometers Run', 'Day of the Week');

/* buttons */
let pastBtn = document.getElementById('past-btn')
pastBtn.addEventListener('click', () => onPastClick(null, 'Walk'))
let futureBtn = document.getElementById('future-btn')
futureBtn.addEventListener('click', onFutureClick)
let submitBtn;
let progressBtn = document.getElementById('progress-btn')
progressBtn.addEventListener('click', showChart)
let chartBtn = document.getElementById('chart-btn')
chartBtn.addEventListener('click', chartSubmit)

/* dropdowns */
let dropdownPast = document.getElementById('dropdown-past')
dropdownPast.addEventListener('change', onPastSelect)
let dropdownFuture = document.getElementById('dropdown-future')

// set default value of input to 'km'
let unitsInput = document.getElementById('units-input')
unitsInput.value = 'km'

/* global var */
let reminderActivity

/* reminder elems */
let yes = document.getElementById('yes')
let no = document.getElementById('no')
yes.addEventListener('click', () => {
  console.log(reminderActivity.date, reminderActivity.activity)

  // show form
  onPastClick(reminderActivity.date, reminderActivity.activity)

  // hide reminder
  document.getElementById('reminder').style.display = 'none'

  // delete the activity from db
  console.log(reminderActivity)
  deleteReminder(reminderActivity)
})
no.addEventListener('click', () => {
  document.getElementById('reminder').style.display = 'none'
  deleteReminder(reminderActivity)
})

/* chart elems */
document.getElementById('chart-exit')
.addEventListener('click', hideChart)




/* funcs */

function deleteReminder(activity) {
  fetch(`delete?rowIdNum=${activity.rowIdNum}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  .then(response => response.json())
  .then(result => console.log(result))
  .catch(err => console.log('delete failed'))
}

function getName() {
  console.log('getting name')
  fetch('/name', {
    method: 'GET',
  })
  .then(res => res.json())
  .then(res => {
    /* set fname */
    console.log(res)
    document.getElementById('fname').textContent = res  
  })
  .catch(err => console.log('failed to fetch name'))
}

getName()

function passDataToChart(result, activity) {
  // prep the data
  console.log('result', result)

  // pass data to barchart
  let ylabel
  if (activity === 'Walk') {
    ylabel = `Kilometers Walked`
  } else if (activity === 'Run') {
    ylabel = `Kilometers Ran`
  } else if (activity === 'Bike') {
    ylabel = `Kilometers Biked`
  } else if (activity === 'Basketball') {
    ylabel = `Minutes Played`
  } else if (activity === 'Swim') {
    ylabel = `Laps Swam`
  }
  barchart.render(result, ylabel, 'Day of the Week');
}

function chartSubmit() {
  // get values in the activity and date fields and make a request
  // to the /week route
  let activity = document.getElementById('chart-activity').value
  let dateStr = document.getElementById('chart-week').value
  let dateMs = new Date(dateStr).getTime()
  // console.log(dateStr, dateMs)
  
  fetch(`/week?date=${dateMs}&activity=${activity}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  .then(response => response.json())
  .then(result => {
    let res = result.map(r => { return {
      date: r.date + 86400000,
      value: r.value
    }})
    passDataToChart(res, activity)
  })
  .catch(error => alert('Date out of range.'))
}

// get chart data
function showChart() {
  let offsetMs = new Date().getTimezoneOffset() * 60000
  let today = new Date(
    new Date().getTime() - offsetMs
  )
  let ydayMs = today.setDate(today.getDate() - 1)

  // show chart 
  document.getElementById('chart-container').style.display = 'block'
  document.getElementById('overlay').style.display = 'block'

  // set default date to yesterday
  let ydayStr = 
    new Date(ydayMs).toISOString().split('T')[0]
  console.log(ydayStr, ydayMs)
  document.getElementById('chart-week').value = ydayStr

  // fetch data
  fetch(`/week?date=${ydayMs}&activity=Walk`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  .then(response => response.json())
  .then(result => {
    console.log(result.map(r => {
      return {
        date: r.date, value: r.amount    
      }
    }))
    passDataToChart(result, 'Walk')
  })
}

function hideChart() {
  document.getElementById('chart-container').style.display = 'none'
  document.getElementById('overlay').style.display = 'none'
}

// fetch to /reminder
function getReminder() {
  fetch('/reminder', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  .then(response => response.json())
  .then(result => {
    console.log('reminder', result)

    // set global
    reminderActivity = result

    // vars
    let today = new Date()
    let activity = new Date(result.date) 

    let days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]

    // get elems
    let reminder = document.getElementById('reminder')
    let reminderQ = document.getElementById('reminder-q')

    // insert the reminder message
    // yesterday
    // browser is 1 day behind so just add 1
    let dayDiff = today.getDay() - (activity.getDay() + 1)
    let msDiff = today.getTime() - activity.getTime()
    // console.log(`${today} - ${activityDay} = ${dayDiff}`)
    if (dayDiff === 1) {
      // did you "" yesterday?
      reminderQ.textContent = `Did you ${result.activity} yesterday?`
      reminder.style.display = 'flex'
    // earlier in the week
    } else if (dayDiff <= 6 && msDiff < 604800000) {
      // did you "" on activityDay?
      let index = today.getDay() - dayDiff
      if (index == 7) index = 0
      reminderQ.textContent = `Did you ${result.activity} on ${days[index]}?`
      reminder.style.display = 'flex'
    } 
  })
  .catch(error => console.log(error))
}

function onPastClick(date, activity) {
  // hide btn and show form
  pastBtn.style.display = 'none'
  let form = document.getElementById('past-activity-form')
  form.style.display = 'flex'

  console.log(date)
  let datestr = date ? new Date(date).toISOString().split('T')[0] : null

  // hide stuff from prev submit
  document.getElementById('past-activity-msg').style.display = 'none'
  document.getElementById('date-past').value = datestr
  document.getElementById('td-input').value = null
  dropdownPast.value = activity

  // get the submit button
  submitBtn = document.getElementById('submit-past')
  submitBtn.addEventListener('click', submitPast) 
}

function onFutureClick() {
  // hide btn and show form
  futureBtn.style.display = 'none';
  let form = document.getElementById('future-plans-form')
  form.style.display = 'flex'

  // clear stuff from previous submit
  document.getElementById('future-plans-msg').style.display = 'none'
  document.getElementById('date-future').value = null

  // get the submit button
  submitBtn = document.getElementById('submit-future')
  submitBtn.addEventListener('click', submitFuture) 
}

function onPastSelect() {
  let curr = dropdownPast.options[dropdownPast.selectedIndex].value
  if (curr === 'Walk' || curr === 'Run' || curr === 'Bike') {
    unitsInput.value = 'km'
  } if (curr === 'Basketball') {
    unitsInput.value = 'minutes'
  } if (curr === 'Swim') {
    unitsInput.value = 'laps'
  }
}

function submitPast() {
  // post request
  let date = document.getElementById('date-past').value
  let activity = document.getElementById('dropdown-past').value
  let amount = document.getElementById('td-input').value
  let units = document.getElementById('units-input').value

  let data = {
    date: date, // string 'yyyy-mm-dd'
    activity: activity, 
    amount: amount,
    units: units
  }

  if (date && activity && amount && units) {
    console.log('Past Activity Sending:')
    console.log(data)

    fetch('/store', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
      console.log('Past Activity Success:', result)
      showPastMessage(activity, amount, units)
    })
  } else {
    alert('You must fill out all fields.')
  }
}

function submitFuture() {
  let date = document.getElementById('date-future').value
  let activity = document.getElementById('dropdown-future').value

  let data = {
    date: date,
    activity: activity
  }

  if (date && activity) {
    console.log('Future Plan Sending:')
    console.log(data)

    fetch('/store', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
      console.log('Future Plan Success:', result)
      showFutureMessage(date, activity)
    })
  } else alert('You must fill out all fields.')
}

function showPastMessage(activity, amount, units) {
  let p = document.getElementById('past-activity-msg')
  p.innerText = ''
  p.style.display = 'flex'
  document.getElementById('past-activity-form').style.display = 'none'
  pastBtn.style.display = 'block'

  p.innerText = `Got it! ${activity} for ${amount} ${units}. Keep it up!`
}

function showFutureMessage(date, activity) {
  let p = document.getElementById('future-plans-msg')
  p.innerText = ''
  p.style.display = 'flex'
  document.getElementById('future-plans-form').style.display = 'none'
  futureBtn.style.display = 'block'

  p.innerText = `Sounds good! Don't forget to come back to update your session for ${activity} on ${date}.`
}

// calls
getReminder()