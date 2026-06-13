-- CreateIndex
CREATE INDEX "Player_workspaceId_idx" ON "Player"("workspaceId");

-- CreateIndex
CREATE INDEX "Training_workspaceId_date_idx" ON "Training"("workspaceId", "date");

-- CreateIndex
CREATE INDEX "Match_workspaceId_date_idx" ON "Match"("workspaceId", "date");

-- CreateIndex
CREATE INDEX "MatchLineup_playerId_idx" ON "MatchLineup"("playerId");

-- CreateIndex
CREATE INDEX "Rating_playerId_date_idx" ON "Rating"("playerId", "date");

-- CreateIndex
CREATE INDEX "HealthCheck_playerId_date_idx" ON "HealthCheck"("playerId", "date");

-- CreateIndex
CREATE INDEX "Award_workspaceId_date_idx" ON "Award"("workspaceId", "date");

-- CreateIndex
CREATE INDEX "WinnerPoint_workspaceId_date_idx" ON "WinnerPoint"("workspaceId", "date");

-- CreateIndex
CREATE INDEX "Attendance_playerId_idx" ON "Attendance"("playerId");

-- CreateIndex
CREATE INDEX "Material_workspaceId_idx" ON "Material"("workspaceId");

-- CreateIndex
CREATE INDEX "TacticBoard_workspaceId_idx" ON "TacticBoard"("workspaceId");

-- CreateIndex
CREATE INDEX "Task_workspaceId_idx" ON "Task"("workspaceId");

-- CreateIndex
CREATE INDEX "Note_workspaceId_idx" ON "Note"("workspaceId");

-- CreateIndex
CREATE INDEX "ExternalLink_workspaceId_idx" ON "ExternalLink"("workspaceId");

-- CreateIndex
CREATE INDEX "MondayTraining_workspaceId_date_idx" ON "MondayTraining"("workspaceId", "date");

-- CreateIndex
CREATE INDEX "CoachMessage_workspaceId_idx" ON "CoachMessage"("workspaceId");

-- CreateIndex
CREATE INDEX "PlayerFeedback_workspaceId_idx" ON "PlayerFeedback"("workspaceId");

