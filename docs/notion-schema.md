# Notion Database Schema

## Users

Title: `Name`

Properties:

- `Discord User ID`: rich text, unique logical key
- `Discord Username`: rich text
- `Active`: checkbox
- `Joined At`: date
- `Daily Checkins`: relation to Daily Checkins
- `Trades`: relation to Trade Journal
- `Goals`: relation to Goals
- `Discipline Logs`: relation to Discipline Logs

Rollups:

- `Total Trades`: count of `Trades`
- `Completed Goals`: count values where Goals `Status` is `Completed`

## Daily Checkins

Title: `Checkin ID` formatted as `discordUserId:yyyy-mm-dd`

Properties:

- `User`: relation to Users
- `Discord User ID`: rich text
- `Date`: date
- `Mood`: number
- `Sleep Hours`: number
- `Energy`: number
- `Focus`: number
- `Trading Plan`: rich text

Constraint enforced in app:

- One `Discord User ID` + `Date` record per day.

## Trade Journal

Title: `Trade ID`

Properties:

- `User`: relation to Users
- `Discord User ID`: rich text
- `Date`: date
- `Pair`: select
- `Direction`: select, `Long` or `Short`
- `Entry`: number
- `Stop Loss`: number
- `Take Profit`: number
- `Risk %`: number
- `Result`: select, `Win`, `Loss`, `BE`, `Open`
- `Screenshot URL`: url
- `RR`: formula, `abs(prop("Take Profit") - prop("Entry")) / abs(prop("Entry") - prop("Stop Loss"))`
- `Performance R`: formula, `if(prop("Result") == "Win", prop("RR"), if(prop("Result") == "Loss", -1, 0))`

## Goals

Title: `Goal`

Properties:

- `Goal ID`: rich text
- `User`: relation to Users
- `Discord User ID`: rich text
- `Category`: select
- `Deadline`: date
- `Status`: status, `Not Started`, `In Progress`, `Completed`, `Blocked`
- `Created At`: date
- `Completed At`: date

## Discipline Logs

Title: `Discipline ID` formatted as `discordUserId:yyyy-mm-dd`

Properties:

- `User`: relation to Users
- `Discord User ID`: rich text
- `Date`: date
- `Followed Plan`: checkbox
- `Revenge Traded`: checkbox
- `Overtraded`: checkbox
- `Broke Risk Rules`: checkbox
- `Score`: formula, `toNumber(prop("Followed Plan")) * 25 + if(prop("Revenge Traded"), 0, 25) + if(prop("Overtraded"), 0, 25) + if(prop("Broke Risk Rules"), 0, 25)`

Constraint enforced in app:

- One `Discord User ID` + `Date` record per day.

## Reports

Title: `Report ID`

Properties:

- `Type`: select, `Daily`, `Weekly`, `Monthly`
- `Period Start`: date
- `Period End`: date
- `Generated At`: date
- `Content`: rich text

## Relationships

Users is the parent database. Daily Checkins, Trade Journal, Goals, and Discipline Logs all relation back to Users. Reports are global and not user-specific unless the generated report content includes per-user sections.
