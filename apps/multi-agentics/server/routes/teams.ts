/**
 * Team & agent routes.
 */

import { Router } from 'express'
import { store } from '../state'

export const teamsRouter = Router()

/** GET /api/teams — all teams with their agent rosters embedded. */
teamsRouter.get('/', (_req, res) => {
  const teams = store.teams().map((t) => ({
    ...t,
    supervisor: store.agent(t.supervisorId),
    agents: store.agentsOfTeam(t.id),
  }))
  res.json({ teams })
})

/** GET /api/teams/:id — a single team. */
teamsRouter.get('/:id', (req, res) => {
  const team = store.team(req.params.id)
  if (!team) return res.status(404).json({ error: 'team not found' })
  res.json({
    team: { ...team, supervisor: store.agent(team.supervisorId), agents: store.agentsOfTeam(team.id) },
  })
})

export const agentsRouter = Router()

/** GET /api/agents — flat list of every agent. */
agentsRouter.get('/', (req, res) => {
  const teamId = req.query.team as string | undefined
  const agents = teamId ? store.agentsOfTeam(teamId) : store.agents()
  res.json({ agents, total: agents.length })
})

/** GET /api/agents/:id — a single agent. */
agentsRouter.get('/:id', (req, res) => {
  const agent = store.agent(req.params.id)
  if (!agent) return res.status(404).json({ error: 'agent not found' })
  res.json({ agent, team: store.team(agent.teamId) })
})
