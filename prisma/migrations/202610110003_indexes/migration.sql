CREATE INDEX "Service_clientId_startsAt_endsAt_idx" ON "Service"("clientId","startsAt","endsAt");
CREATE INDEX "Proposal_clientId_stage_idx" ON "Proposal"("clientId","stage");
CREATE INDEX "Task_assigneeId_isDemo_status_idx" ON "Task"("assigneeId","isDemo","status");
CREATE INDEX "TimelineEvent_clientId_createdAt_idx" ON "TimelineEvent"("clientId","createdAt");
