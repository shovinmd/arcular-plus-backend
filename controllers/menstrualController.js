const MenstrualCycle = require('../models/MenstrualCycle');

// Get menstrual cycle data for a user
exports.getMenstrualByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const data = await MenstrualCycle.findOne({ userId });
    
    if (!data) {
      return res.status(404).json({ error: 'No menstrual cycle data found for this user' });
    }
    
    console.log('✅ Retrieved menstrual data for user:', userId);
    res.json(data);
  } catch (err) {
    console.error('❌ Error getting menstrual data:', err);
    res.status(500).json({ error: err.message });
  }
};

// Create or update menstrual cycle data (main method)
exports.createMenstrual = async (req, res) => {
  try {
    console.log('🔍 Creating/updating menstrual data:', req.body);
    
    // Validate required fields
    if (!req.body.userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }
    
    if (!req.body.lastPeriodStartDate || !req.body.cycleLength || !req.body.periodDuration) {
      return res.status(400).json({ error: 'Missing required cycle data: lastPeriodStartDate, cycleLength, periodDuration' });
    }
    
    // Check if user already has data
    const existingData = await MenstrualCycle.findOne({ userId: req.body.userId });
    
    if (existingData) {
      console.log('🔍 Updating existing data for user:', req.body.userId);
      
      // Update with all received data
      const updateData = {
        lastPeriodStartDate: new Date(req.body.lastPeriodStartDate),
        cycleLength: req.body.cycleLength,
        periodDuration: req.body.periodDuration,
        cycleHistory: req.body.cycleHistory || [],
        // Store frontend calculated predictions
        nextPeriod: req.body.nextPeriod ? new Date(req.body.nextPeriod) : undefined,
        ovulationDay: req.body.ovulationDay ? new Date(req.body.ovulationDay) : undefined,
        fertileWindow: req.body.fertileWindow ? req.body.fertileWindow.map(date => new Date(date)) : undefined,
        periodEnd: req.body.periodEnd ? new Date(req.body.periodEnd) : undefined,
        // Store reminder preferences
        remindNextPeriod: req.body.remindNextPeriod,
        remindFertileWindow: req.body.remindFertileWindow,
        remindOvulation: req.body.remindOvulation,
        reminderTime: req.body.reminderTime,
      };
      
      // Update existing data
      const updated = await MenstrualCycle.findByIdAndUpdate(
        existingData._id, 
        updateData, 
        { new: true }
      );
      
      console.log('✅ Updated menstrual data successfully');
      console.log('🔍 Stored data:', {
        cycleHistory: updated.cycleHistory?.length || 0,
        predictions: {
          nextPeriod: updated.nextPeriod ? 'Yes' : 'No',
          ovulationDay: updated.ovulationDay ? 'Yes' : 'No',
          fertileWindow: updated.fertileWindow ? 'Yes' : 'No',
          periodEnd: updated.periodEnd ? 'Yes' : 'No'
        },
        reminders: {
          nextPeriod: updated.remindNextPeriod,
          fertileWindow: updated.remindFertileWindow,
          ovulation: updated.remindOvulation,
          time: updated.reminderTime
        }
      });
      
      res.json(updated);
    } else {
      console.log('🔍 Creating new data for user:', req.body.userId);
      
      // Create new data
      const newData = {
        userId: req.body.userId,
        lastPeriodStartDate: new Date(req.body.lastPeriodStartDate),
        cycleLength: req.body.cycleLength,
        periodDuration: req.body.periodDuration,
        cycleHistory: req.body.cycleHistory || [],
        // Store frontend calculated predictions
        nextPeriod: req.body.nextPeriod ? new Date(req.body.nextPeriod) : undefined,
        ovulationDay: req.body.ovulationDay ? new Date(req.body.ovulationDay) : undefined,
        fertileWindow: req.body.fertileWindow ? req.body.fertileWindow.map(date => new Date(date)) : undefined,
        periodEnd: req.body.periodEnd ? new Date(req.body.periodEnd) : undefined,
        // Store reminder preferences
        remindNextPeriod: req.body.remindNextPeriod,
        remindFertileWindow: req.body.remindFertileWindow,
        remindOvulation: req.body.remindOvulation,
        reminderTime: req.body.reminderTime,
      };
      
      const entry = new MenstrualCycle(newData);
      await entry.save();
      
      console.log('✅ Created new menstrual data successfully');
      console.log('🔍 Stored data:', {
        cycleHistory: entry.cycleHistory?.length || 0,
        predictions: {
          nextPeriod: entry.nextPeriod ? 'Yes' : 'No',
          ovulationDay: entry.ovulationDay ? 'Yes' : 'No',
          fertileWindow: entry.fertileWindow ? 'Yes' : 'No',
          periodEnd: entry.periodEnd ? 'Yes' : 'No'
        },
        reminders: {
          nextPeriod: entry.remindNextPeriod,
          fertileWindow: entry.remindFertileWindow,
          ovulation: entry.remindOvulation,
          time: entry.reminderTime
        }
      });
      
      res.status(201).json(entry);
    }
  } catch (err) {
    console.error('❌ Error in createMenstrual:', err);
    res.status(400).json({ error: err.message });
  }
};

// Update menstrual cycle entry (alternative method)
exports.updateMenstrual = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await MenstrualCycle.findByIdAndUpdate(id, req.body, { new: true });
    
    if (!updated) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    console.log('✅ Updated menstrual entry successfully');
    res.json(updated);
  } catch (err) {
    console.error('❌ Error updating menstrual entry:', err);
    res.status(400).json({ error: err.message });
  }
};

// Delete individual cycle entry from history
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
      console.log('✅ Deleted cycle entry successfully');
      res.json({ message: 'Cycle entry deleted successfully' });
    } else {
      res.status(404).json({ error: 'No cycle history found' });
    }
  } catch (err) {
    console.error('❌ Error deleting cycle entry:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get upcoming reminders using stored frontend predictions
exports.getUpcomingReminders = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get user's menstrual cycle data
    const userData = await MenstrualCycle.findOne({ userId });
    if (!userData) {
      return res.status(404).json({ error: 'User data not found' });
    }
    
    // Check if we have stored predictions
    if (!userData.nextPeriod || !userData.ovulationDay || !userData.fertileWindow) {
      console.log('⚠️ No stored predictions available for user:', userId);
      return res.json({ success: true, data: [] });
    }
    
    // Use stored frontend predictions
    const nextPeriod = new Date(userData.nextPeriod);
    const ovulationDay = new Date(userData.ovulationDay);
    const fertileWindowStart = new Date(userData.fertileWindow[0]);
    const fertileWindowEnd = new Date(userData.fertileWindow[userData.fertileWindow.length - 1]);
    
    console.log('✅ Using stored frontend predictions for reminders');
    
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
    
    console.log('✅ Generated ${reminders.length} upcoming reminders using stored predictions');
    res.json({ success: true, data: reminders });
  } catch (err) {
    console.error('❌ Error in getUpcomingReminders:', err);
    res.status(500).json({ error: err.message });
  }
}; 