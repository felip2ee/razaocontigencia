-- Catálogo de ações de aquecimento. Antes isto vivia só em lib/seed.ts, que
-- ninguém rodava em produção: sem catálogo, o sorteio não acha nenhuma ação
-- elegível e o aquecimento nunca gera tarefa. Agora entra pela migração, que
-- o entrypoint já roda. ON CONFLICT: idempotente, e não pisa em edições manuais.
INSERT INTO "warmup_action" ("nome", "categoria", "idade_min_dias", "idade_max_dias", "peso") VALUES
	('Definir foto de perfil', 'perfil', 0, 3, 2),
	('Definir nome e recado', 'perfil', 0, 3, 2),
	('Ficar 10 minutos online', 'perfil', 0, NULL, 2),
	('Ver o status dos outros números', 'perfil', 0, NULL, 1),
	('Postar um status', 'perfil', 4, NULL, 1),
	('Trocar 5 mensagens de texto com outro número', 'conversa', 4, NULL, 3),
	('Responder as mensagens recebidas do dia', 'conversa', 4, NULL, 2),
	('Conversa de 15 mensagens, ida e volta', 'conversa', 8, NULL, 2),
	('Responder uma mensagem antiga', 'conversa', 15, NULL, 1),
	('Mandar um áudio curto', 'midia', 8, NULL, 2),
	('Mandar uma foto', 'midia', 8, NULL, 2),
	('Mandar um sticker', 'midia', 8, NULL, 1),
	('Mandar um documento PDF', 'midia', 15, NULL, 1),
	('Chamada de voz de 1 minuto', 'midia', 15, NULL, 1),
	('Entrar em um grupo', 'grupo', 8, 14, 1),
	('Mandar mensagem em um grupo', 'grupo', 15, NULL, 2),
	('Participar de conversa em grupo por 10 minutos', 'grupo', 15, NULL, 1)
ON CONFLICT ("nome") DO NOTHING;
