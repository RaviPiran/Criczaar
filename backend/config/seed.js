require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./db');
const Room = require('../models/Room');
const Team = require('../models/Team');
const Player = require('../models/Player');

const seedData = async () => {
  await connectDB();

  await Room.deleteMany({});
  await Team.deleteMany({});
  await Player.deleteMany({});

  const room = await Room.create({
    name: 'IPL Mega Auction 2025',
    code: 'IPL2025',
    rules: {
      basePrice: 0.5,
      bidIncrement: 0.5,
      timerSeconds: 30,
      rtmCards: 2,
      maxPlayers: 11,
    },
    status: 'setup',
  });

  const teamsData = [
    { name: 'Mumbai Indians', color: '#1a78c2', budget: 100 },
    { name: 'Chennai Super Kings', color: '#f9cd05', budget: 100 },
    { name: 'Royal Challengers', color: '#e8152b', budget: 100 },
    { name: 'Delhi Capitals', color: '#17479e', budget: 100 },
    { name: 'Kolkata Knight Riders', color: '#3a225d', budget: 100 },
  ];

  const teams = await Team.insertMany(
    teamsData.map(t => ({ ...t, budgetLeft: t.budget, room: room._id, slots: 11, players: [] }))
  );

  const playersData = [
    { name: 'Virat Kohli', role: 'Batsman', country: 'India', age: 35, basePrice: 2, matches: 237, battingAvg: 57.5, strikeRate: 139.7, wickets: 4 },
    { name: 'Rohit Sharma', role: 'Batsman', country: 'India', age: 36, basePrice: 2, matches: 243, battingAvg: 52.3, strikeRate: 134.2, wickets: 15 },
    { name: 'Jasprit Bumrah', role: 'Bowler', country: 'India', age: 30, basePrice: 2, matches: 135, battingAvg: 8.2, strikeRate: 96.1, wickets: 145 },
    { name: 'Ben Stokes', role: 'All-Rounder', country: 'England', age: 32, basePrice: 1.5, matches: 105, battingAvg: 36.4, strikeRate: 128.5, wickets: 68 },
    { name: 'Jos Buttler', role: 'Wicket-Keeper', country: 'England', age: 33, basePrice: 1.5, matches: 168, battingAvg: 45.8, strikeRate: 149.3, wickets: 0 },
    { name: 'Pat Cummins', role: 'Bowler', country: 'Australia', age: 30, basePrice: 1.5, matches: 101, battingAvg: 18.3, strikeRate: 107.2, wickets: 134 },
    { name: 'David Warner', role: 'Batsman', country: 'Australia', age: 37, basePrice: 1.5, matches: 184, battingAvg: 41.6, strikeRate: 142.0, wickets: 2 },
    { name: 'Rashid Khan', role: 'Bowler', country: 'Afghanistan', age: 25, basePrice: 2, matches: 122, battingAvg: 16.4, strikeRate: 140.5, wickets: 145 },
    { name: 'Hardik Pandya', role: 'All-Rounder', country: 'India', age: 30, basePrice: 1.5, matches: 115, battingAvg: 27.9, strikeRate: 147.4, wickets: 54 },
    { name: 'KL Rahul', role: 'Wicket-Keeper', country: 'India', age: 31, basePrice: 1.5, matches: 132, battingAvg: 48.5, strikeRate: 136.8, wickets: 0 },
    { name: 'Suryakumar Yadav', role: 'Batsman', country: 'India', age: 33, basePrice: 1, matches: 76, battingAvg: 46.1, strikeRate: 175.4, wickets: 0 },
    { name: 'Mitchell Starc', role: 'Bowler', country: 'Australia', age: 34, basePrice: 1, matches: 97, battingAvg: 8.7, strikeRate: 88.2, wickets: 97 },
  ];

  await Player.insertMany(
    playersData.map(p => ({ ...p, room: room._id, status: 'remaining' }))
  );

  console.log('✅ Database seeded successfully!');
  console.log(`📌 Room Code: ${room.code}`);
  process.exit(0);
};

seedData().catch(err => { console.error(err); process.exit(1); });
