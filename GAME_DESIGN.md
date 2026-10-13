# Game design: vertical slice

The player is Lima's transport minister. The first loop is: inspect a simulated congested corridor, approve a bike lane, advance six simulated months, then see temporary capacity loss give way to reduced car demand.

Public budget and personal balance remain separate. Politics, procurement, corruption and elections are intentionally out of the vertical slice; their data belongs in future domain modules, not UI components.

Balance values live in `src/simulation/config.ts`. A bike lane costs $18M, builds in six months, removes 28% of corridor capacity while under construction, and reduces completed-corridor car demand by 16%.
