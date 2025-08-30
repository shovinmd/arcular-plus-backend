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
      
      console.log('🔍 Complete data received:', {
        userId: req.body.userId,
        lastPeriodStartDate: req.body.lastPeriodStartDate,
        cycleLength: req.body.cycleLength,
        periodDuration: req.body.periodDuration,
        nextPeriod: req.body.nextPeriod,
        ovulationDay: req.body.ovulationDay,
        fertileWindow: req.body.fertileWindow,
        periodEnd: req.body.periodEnd,
        remindNextPeriod: req.body.remindNextPeriod,
        remindFertileWindow: req.body.remindFertileWindow,
        remindOvulation: req.body.remindOvulation,
        reminderTime: req.body.reminderTime,
      });
    
    // Check if user already has menstrual cycle data
    const existingData = await MenstrualCycle.findOne({ userId: req.body.userId });
    
    // Special case: If only preferences are sent (no cycle data), create basic entry
    const isPreferenceOnly = !req.body.lastPeriodStartDate && !req.body.cycleLength && 
                             !req.body.periodDuration && !req.body.nextPeriod && 
                             !req.body.ovulationDay && !req.body.fertileWindow && 
                             !req.body.periodEnd;
    
    if (isPreferenceOnly && !existingData) {
      console.log('🔍 Creating preference-only entry for new user:', req.body.userId);
      
      const preferenceData = {
        userId: req.body.userId,
        // Set default values for required fields
        lastPeriodStartDate: new Date(), // Today as default
        cycleLength: 28, // Default cycle length
        periodDuration: 5, // Default period duration
        cycleHistory: [],
        // Reminder preferences
        remindNextPeriod: req.body.remindNextPeriod !== undefined ? req.body.remindNextPeriod : false,
        remindFertileWindow: req.body.remindFertileWindow !== undefined ? req.body.remindFertileWindow : false,
        remindOvulation: req.body.remindOvulation !== undefined ? req.body.remindOvulation : false,
        reminderTime: req.body.reminderTime || '09:00',
      };
      
      const entry = new MenstrualCycle(preferenceData);
      await entry.save();
      console.log('✅ Created preference-only entry successfully');
      res.status(201).json(entry);
      return;
    }
    
    if (existingData) {
      console.log('🔍 Updating existing data for user:', req.body.userId);
      
      // Build update data - only update fields that are sent
      const updateData = {};
      
      // Update cycle data only if sent
      if (req.body.lastPeriodStartDate !== undefined) {
        updateData.lastPeriodStartDate = req.body.lastPeriodStartDate;
      }
      if (req.body.cycleLength !== undefined) {
        updateData.cycleLength = req.body.cycleLength;
      }
      if (req.body.periodDuration !== undefined) {
        updateData.periodDuration = req.body.periodDuration;
      }
      if (req.body.cycleHistory !== undefined) {
        updateData.cycleHistory = req.body.cycleHistory;
      }
      
      // Update predictions only if sent
      if (req.body.nextPeriod !== undefined) {
        updateData.nextPeriod = req.body.nextPeriod ? new Date(req.body.nextPeriod) : undefined;
      }
      if (req.body.ovulationDay !== undefined) {
        updateData.ovulationDay = req.body.ovulationDay ? new Date(req.body.ovulationDay) : undefined;
      }
      if (req.body.fertileWindow !== undefined) {
        updateData.fertileWindow = req.body.fertileWindow ? req.body.fertileWindow.map(date => new Date(date)) : undefined;
      }
      if (req.body.periodEnd !== undefined) {
        updateData.periodEnd = req.body.periodEnd ? new Date(req.body.periodEnd) : undefined;
      }
      
      // Always update reminder preferences if sent (including false values)
      if (req.body.remindNextPeriod !== undefined) {
        updateData.remindNextPeriod = req.body.remindNextPeriod;
        console.log('🔍 Will update remindNextPeriod to:', req.body.remindNextPeriod);
      }
      if (req.body.remindFertileWindow !== undefined) {
        updateData.remindFertileWindow = req.body.remindFertileWindow;
        console.log('🔍 Will update remindFertileWindow to:', req.body.remindFertileWindow);
      }
      if (req.body.remindOvulation !== undefined) {
        updateData.remindOvulation = req.body.remindOvulation;
        console.log('🔍 Will update remindOvulation to:', req.body.remindOvulation);
      }
      if (req.body.reminderTime !== undefined) {
        updateData.reminderTime = req.body.reminderTime;
        console.log('🔍 Will update reminderTime to:', req.body.reminderTime);
      }
      
      console.log('🔍 Update data to be applied:', updateData);
      
      // Update existing data
      console.log('🔍 Executing database update with data:', updateData);
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
      
      // Verify the update worked
      console.log('🔍 Verification - checking if preferences were actually saved:');
      const verification = await MenstrualCycle.findById(existingData._id);
      console.log('   - remindNextPeriod in DB:', verification.remindNextPeriod);
      console.log('   - remindFertileWindow in DB:', verification.remindFertileWindow);
      console.log('   - remindOvulation in DB:', verification.remindOvulation);
      console.log('   - reminderTime in DB:', verification.reminderTime);
      
      res.json(updated);
    } else {
      console.log('🔍 Creating new data for user:', req.body.userId);
      
      // Create with frontend calculations and preferences
      const newData = {
        userId: req.body.userId,
        // Include cycle data only if sent
        ...(req.body.lastPeriodStartDate && { lastPeriodStartDate: req.body.lastPeriodStartDate }),
        ...(req.body.cycleLength && { cycleLength: req.body.cycleLength }),
        ...(req.body.periodDuration && { periodDuration: req.body.periodDuration }),
        ...(req.body.cycleHistory && { cycleHistory: req.body.cycleHistory }),
        // Include predictions only if sent
        ...(req.body.nextPeriod && { nextPeriod: new Date(req.body.nextPeriod) }),
        ...(req.body.ovulationDay && { ovulationDay: new Date(req.body.ovulationDay) }),
        ...(req.body.fertileWindow && { fertileWindow: req.body.fertileWindow.map(date => new Date(date)) }),
        ...(req.body.periodEnd && { periodEnd: new Date(req.body.periodEnd) }),
        // Always include reminder preferences if sent (including false values)
        ...(req.body.remindNextPeriod !== undefined && { remindNextPeriod: req.body.remindNextPeriod }),
        ...(req.body.remindFertileWindow !== undefined && { remindFertileWindow: req.body.remindFertileWindow }),
        ...(req.body.remindOvulation !== undefined && { remindOvulation: req.body.remindOvulation }),
        ...(req.body.reminderTime && { reminderTime: req.body.reminderTime }),
      };
      
      console.log('🔍 New data to be created:', newData);
      
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

// Add a new cycle entry to history (separate from basic data update)
exports.addCycleEntry = async (req, res) => {
  try {
    const { userId, startDate, cycleLength, periodDuration } = req.body;
    
    if (!userId || !startDate || !cycleLength || !periodDuration) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, startDate, cycleLength, periodDuration' 
      });
    }

    // Find existing user data
    let userData = await MenstrualCycle.findOne({ userId });
    
    if (!userData) {
      return res.status(404).json({ error: 'User menstrual data not found. Please save basic cycle data first.' });
    }

    // Create new cycle entry
    const newEntry = {
      id: Date.now().toString(), // Simple ID generation
      startDate: startDate,
      cycleLength: cycleLength,
      periodDuration: periodDuration,
      createdAt: new Date().toISOString(),
    };

    // Add to cycle history
    if (!userData.cycleHistory) {
      userData.cycleHistory = [];
    }
    
    userData.cycleHistory.push(newEntry);
    
    // Save updated data
    await userData.save();
    
    console.log('✅ Added new cycle entry to history for user:', userId);
    console.log('🔍 Total cycle history entries:', userData.cycleHistory.length);
    
    res.json({ 
      success: true, 
      message: 'Cycle entry added successfully',
      cycleHistory: userData.cycleHistory 
    });
  } catch (err) {
    console.error('❌ Error in addCycleEntry:', err);
    res.status(500).json({ error: err.message });
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

// REMOVED: calculatePredictions function - using frontend calculations only
// Frontend calculates: NextPeriod = LMP + CycleLength, OvulationDay = NextPeriod - 14, etc.
// Backend only stores and uses these frontend-calculated values for FCM and reminders

// Get upcoming reminders using frontend-calculated predictions only
exports.getUpcomingReminders = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get user's menstrual cycle data
    const userData = await MenstrualCycle.findOne({ userId });
    if (!userData) {
      return res.status(404).json({ error: 'User data not found' });
    }

    // Only use stored frontend calculations - no backend calculations
    if (!userData.nextPeriod || !userData.ovulationDay || !userData.fertileWindow) {
      console.log('⚠️ No frontend calculations available, skipping reminders');
      return res.json({ success: true, data: [] });
    }

    // Use stored frontend calculations
    const nextPeriod = new Date(userData.nextPeriod);
    const ovulationDay = new Date(userData.ovulationDay);
    const fertileWindowStart = new Date(userData.fertileWindow[0]);
    const fertileWindowEnd = new Date(userData.fertileWindow[userData.fertileWindow.length - 1]);
    
    console.log('✅ Using stored frontend calculations for reminders');

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