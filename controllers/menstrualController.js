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
          console.log('🔍 Reminder preferences received:');
      console.log('   - remindNextPeriod:', req.body.remindNextPeriod, '(', typeof req.body.remindNextPeriod, ')');
      console.log('   - remindFertileWindow:', req.body.remindFertileWindow, '(', typeof req.body.remindFertileWindow, ')');
      console.log('   - remindOvulation:', req.body.remindOvulation, '(', typeof req.body.remindOvulation, ')');
      console.log('🔍 Reminder preferences will be updated:', {
        remindNextPeriod: req.body.remindNextPeriod !== undefined,
        remindFertileWindow: req.body.remindFertileWindow !== undefined,
        remindOvulation: req.body.remindOvulation !== undefined,
        reminderTime: req.body.reminderTime !== undefined
      });
    
    // Check if user already has menstrual cycle data
    const existingData = await MenstrualCycle.findOne({ userId: req.body.userId });
    
    if (existingData) {
      console.log('🔍 Updating existing data for user:', req.body.userId);
      
      // Update with frontend calculations and preferences
      const updateData = {
        lastPeriodStartDate: req.body.lastPeriodStartDate,
        cycleLength: req.body.cycleLength,
        periodDuration: req.body.periodDuration,
        cycleHistory: req.body.cycleHistory || [], // Use only what's sent
        // Store frontend calculated predictions
        nextPeriod: req.body.nextPeriod ? new Date(req.body.nextPeriod) : undefined,
        ovulationDay: req.body.ovulationDay ? new Date(req.body.ovulationDay) : undefined,
        fertileWindow: req.body.fertileWindow ? req.body.fertileWindow.map(date => new Date(date)) : undefined,
        periodEnd: req.body.periodEnd ? new Date(req.body.periodEnd) : undefined,
        // Only update reminder preferences if they are explicitly sent
        ...(req.body.remindNextPeriod !== undefined && { remindNextPeriod: req.body.remindNextPeriod }),
        ...(req.body.remindFertileWindow !== undefined && { remindFertileWindow: req.body.remindFertileWindow }),
        ...(req.body.remindOvulation !== undefined && { remindOvulation: req.body.remindOvulation }),
        ...(req.body.reminderTime !== undefined && { reminderTime: req.body.reminderTime }),
      };
      
      // Update existing data
      const updated = await MenstrualCycle.findByIdAndUpdate(
        existingData._id, 
        updateData, 
        { new: true }
      );
      console.log('✅ Updated menstrual data successfully');
      console.log('🔍 Updated cycle history entries:', updated.cycleHistory?.length || 0);
      console.log('🔍 Stored reminder preferences:');
      console.log('   - remindNextPeriod:', updated.remindNextPeriod, '(', typeof updated.remindNextPeriod, ')');
      console.log('   - remindFertileWindow:', updated.remindFertileWindow, '(', typeof updated.remindFertileWindow, ')');
      console.log('   - remindOvulation:', updated.remindOvulation, '(', typeof updated.remindOvulation, ')');
      console.log('   - reminderTime:', updated.reminderTime, '(', typeof updated.reminderTime, ')');
      res.json(updated);
    } else {
      console.log('🔍 Creating new data for user:', req.body.userId);
      
      // Create with frontend calculations and preferences
      const newData = {
        userId: req.body.userId,
        lastPeriodStartDate: req.body.lastPeriodStartDate,
        cycleLength: req.body.cycleLength,
        periodDuration: req.body.periodDuration,
        cycleHistory: req.body.cycleHistory || [], // Use only what's sent
        // Store frontend calculated predictions
        nextPeriod: req.body.nextPeriod ? new Date(req.body.nextPeriod) : undefined,
        ovulationDay: req.body.ovulationDay ? new Date(req.body.ovulationDay) : undefined,
        fertileWindow: req.body.fertileWindow ? req.body.fertileWindow.map(date => new Date(date)) : undefined,
        periodEnd: req.body.periodEnd ? new Date(req.body.periodEnd) : undefined,
        // Only include reminder preferences if they are explicitly sent
        ...(req.body.remindNextPeriod !== undefined && { remindNextPeriod: req.body.remindNextPeriod }),
        ...(req.body.remindFertileWindow !== undefined && { remindFertileWindow: req.body.remindFertileWindow }),
        ...(req.body.remindOvulation !== undefined && { remindOvulation: req.body.remindOvulation }),
        ...(req.body.reminderTime !== undefined && { reminderTime: req.body.reminderTime }),
      };
      
      const entry = new MenstrualCycle(newData);
      await entry.save();
      console.log('✅ Created new menstrual data successfully');
      console.log('🔍 Created cycle history entries:', entry.cycleHistory?.length || 0);
      console.log('🔍 Stored reminder preferences:');
      console.log('   - remindNextPeriod:', entry.remindNextPeriod, '(', typeof entry.remindNextPeriod, ')');
      console.log('   - remindFertileWindow:', entry.remindFertileWindow, '(', typeof entry.remindFertileWindow, ')');
      console.log('   - remindOvulation:', entry.remindOvulation, '(', typeof entry.remindOvulation, ')');
      console.log('   - reminderTime:', entry.reminderTime, '(', typeof entry.reminderTime, ')');
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

    // Use stored frontend calculations instead of recalculating
    let nextPeriod, ovulationDay, fertileWindowStart, fertileWindowEnd;
    
    if (userData.nextPeriod && userData.ovulationDay && userData.fertileWindow) {
      // Use stored frontend calculations
      nextPeriod = new Date(userData.nextPeriod);
      ovulationDay = new Date(userData.ovulationDay);
      fertileWindowStart = new Date(userData.fertileWindow[0]);
      fertileWindowEnd = new Date(userData.fertileWindow[userData.fertileWindow.length - 1]);
      console.log('✅ Using stored frontend calculations for reminders');
    } else {
      // Fallback to backend calculation if frontend data not available
      const lmp = new Date(lastPeriodStartDate);
      nextPeriod = new Date(lmp.getTime() + (cycleLength * 24 * 60 * 60 * 1000));
      ovulationDay = new Date(nextPeriod.getTime() - (14 * 24 * 60 * 60 * 1000));
      fertileWindowStart = new Date(ovulationDay.getTime() - (5 * 24 * 60 * 60 * 1000));
      fertileWindowEnd = new Date(ovulationDay.getTime() + (1 * 24 * 60 * 60 * 1000));
      console.log('⚠️ Using fallback backend calculations for reminders');
    }

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