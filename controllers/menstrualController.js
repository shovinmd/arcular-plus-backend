const MenstrualCycle = require('../models/MenstrualCycle');

exports.getMenstrualByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const data = await MenstrualCycle.find({ userId });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createMenstrual = async (req, res) => {
  try {
    console.log('🔍 Creating/updating menstrual data:', req.body);
    console.log('🔍 Reminder time type:', typeof req.body.reminderTime);
    console.log('🔍 Reminder time value:', req.body.reminderTime);
    
    // Check if user already has menstrual cycle data
    const existingData = await MenstrualCycle.findOne({ userId: req.body.userId });
    
    if (existingData) {
      console.log('🔍 Updating existing data for user:', req.body.userId);
      
      // If there's new cycle data to add to history
      if (req.body.cycleHistory && req.body.cycleHistory.length > 0) {
        // Merge new cycle history with existing
        const newHistory = req.body.cycleHistory.filter(newEntry => 
          !existingData.cycleHistory.some(existingEntry => 
            existingEntry.startDate?.toString() === newEntry.startDate?.toString()
          )
        );
        
        if (newHistory.length > 0) {
          req.body.cycleHistory = [...existingData.cycleHistory, ...newHistory];
          console.log('🔍 Merged cycle history. Total entries:', req.body.cycleHistory.length);
        }
      }
      
      // Update existing data
      const updated = await MenstrualCycle.findByIdAndUpdate(
        existingData._id, 
        req.body, 
        { new: true }
      );
      console.log('✅ Updated menstrual data successfully');
      console.log('🔍 Updated data reminder time:', updated.reminderTime);
      res.json(updated);
    } else {
      console.log('🔍 Creating new data for user:', req.body.userId);
      // Create new entry
      const entry = new MenstrualCycle(req.body);
      await entry.save();
      console.log('✅ Created new menstrual data successfully');
      console.log('🔍 Created data reminder time:', entry.reminderTime);
      res.status(201).json(entry);
    }
  } catch (err) {
    console.error('❌ Error in createMenstrual:', err);
    res.status(400).json({ error: err.message });
  }
};

exports.updateMenstrual = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await MenstrualCycle.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Entry not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteCycleEntry = async (req, res) => {
  try {
    const { userId, entryId } = req.params;
    
    // Find the user's menstrual cycle data
    const userData = await MenstrualCycle.findOne({ userId });
    if (!userData) {
      return res.status(404).json({ error: 'User data not found' });
    }
    
    // Remove the specific entry from cycleHistory
    if (userData.cycleHistory && userData.cycleHistory.length > 0) {
      userData.cycleHistory = userData.cycleHistory.filter(
        entry => entry.id !== entryId
      );
      
      // Save the updated data
      await userData.save();
      res.json({ message: 'Cycle entry deleted successfully' });
    } else {
      res.status(404).json({ error: 'No cycle history found' });
    }
  } catch (err) {
    console.error('❌ Error in deleteCycleEntry:', err);
    res.status(500).json({ error: err.message });
  }
};

// Standardized menstrual cycle calculation methods
exports.calculatePredictions = async (req, res) => {
  try {
    const { lastPeriodStartDate, cycleLength, periodDuration } = req.body;
    
    if (!lastPeriodStartDate || !cycleLength || !periodDuration) {
      return res.status(400).json({ 
        error: 'Missing required fields: lastPeriodStartDate, cycleLength, periodDuration' 
      });
    }

    // Convert string date to Date object
    const lmp = new Date(lastPeriodStartDate);
    
    // Apply standardized formula
    const nextPeriod = new Date(lmp.getTime() + (cycleLength * 24 * 60 * 60 * 1000));
    const ovulationDay = new Date(nextPeriod.getTime() - (14 * 24 * 60 * 60 * 1000));
    const fertileWindowStart = new Date(ovulationDay.getTime() - (5 * 24 * 60 * 60 * 1000));
    const fertileWindowEnd = new Date(ovulationDay.getTime() + (1 * 24 * 60 * 60 * 1000));
    const periodEnd = new Date(nextPeriod.getTime() + ((periodDuration - 1) * 24 * 60 * 60 * 1000));

    // Generate fertile window dates array
    const fertileWindow = [];
    let currentDate = new Date(fertileWindowStart);
    while (currentDate <= fertileWindowEnd) {
      fertileWindow.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const predictions = {
      nextPeriod: nextPeriod.toISOString().split('T')[0],
      ovulationDay: ovulationDay.toISOString().split('T')[0],
      fertileWindow: fertileWindow.map(date => date.toISOString().split('T')[0]),
      periodEnd: periodEnd.toISOString().split('T')[0],
      formula: {
        nextPeriod: 'LMP + CycleLength',
        ovulationDay: 'NextPeriod - 14',
        fertileWindow: '[OvulationDay - 5, OvulationDay + 1]',
        periodEnd: 'NextPeriod + (PeriodDuration - 1)'
      }
    };

    console.log('✅ Calculated predictions using standardized formula:', predictions);
    res.json({ success: true, data: predictions });
  } catch (err) {
    console.error('❌ Error in calculatePredictions:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get upcoming reminders based on standardized calculations
exports.getUpcomingReminders = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get user's menstrual cycle data
    const userData = await MenstrualCycle.findOne({ userId });
    if (!userData) {
      return res.status(404).json({ error: 'User data not found' });
    }

    const { lastPeriodStartDate, cycleLength, periodDuration } = userData;
    
    if (!lastPeriodStartDate || !cycleLength || !periodDuration) {
      return res.status(400).json({ error: 'Incomplete cycle data' });
    }

    // Calculate predictions using standardized formula
    const lmp = new Date(lastPeriodStartDate);
    const nextPeriod = new Date(lmp.getTime() + (cycleLength * 24 * 60 * 60 * 1000));
    const ovulationDay = new Date(nextPeriod.getTime() - (14 * 24 * 60 * 60 * 1000));
    const fertileWindowStart = new Date(ovulationDay.getTime() - (5 * 24 * 60 * 60 * 1000));
    const fertileWindowEnd = new Date(ovulationDay.getTime() + (1 * 24 * 60 * 60 * 1000));

    // Generate upcoming reminders
    const reminders = [];
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

    // Check if predictions are within next 30 days
    if (nextPeriod <= thirtyDaysFromNow && nextPeriod > now) {
      reminders.push({
        type: 'next period',
        title: 'Next Period Reminder',
        description: 'Your period is predicted to start today',
        date: nextPeriod.toISOString().split('T')[0],
        time: userData.reminderTime || '09:00'
      });
    }

    if (ovulationDay <= thirtyDaysFromNow && ovulationDay > now) {
      reminders.push({
        type: 'ovulation',
        title: 'Ovulation Day Reminder',
        description: 'Today is your predicted ovulation day',
        date: ovulationDay.toISOString().split('T')[0],
        time: userData.reminderTime || '09:00'
      });
    }

    if (fertileWindowStart <= thirtyDaysFromNow && fertileWindowEnd > now) {
      reminders.push({
        type: 'fertile window',
        title: 'Fertile Window Reminder',
        description: 'Your fertile window starts today',
        date: fertileWindowStart.toISOString().split('T')[0],
        time: userData.reminderTime || '09:00'
      });
    }

    console.log('✅ Generated ${reminders.length} upcoming reminders using standardized formula');
    res.json({ success: true, data: reminders });
  } catch (err) {
    console.error('❌ Error in getUpcomingReminders:', err);
    res.status(500).json({ error: err.message });
  }
}; 