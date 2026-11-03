async function aprovarSolicitacao(fichaId, uidConvidado, permissao) {
    try {
        // Correção: Adiciona 5 minutos de margem de segurança para evitar bloqueio por diferença de relógio
        const agora = new Date();
        const expiraEm = new Date(agora.getTime() + DURACAO_ACESSO_MS + (5 * 60 * 1000));
        
        await setDoc(doc(db, 'fichas', fichaId, 'acessos', uidConvidado), {
            permissao: permissao,
            aprovadoEm: new Date().toISOString(),
            aprovadoPor: usuarioAtual.uid,
            expiraEm: expiraEm.toISOString() // Salva como texto ISO
        });
        await setDoc(doc(db, 'fichas', fichaId, 'solicitacoes', uidConvidado), {
            status: 'aprovado',
            permissao: permissao,
            respondidoEm: new Date().toISOString()
        }, { merge: true });
        alert(`Acesso aprovado como ${permissao} por 12 horas.`);
        carregarSolicitacoesPendentes();
        carregarDashboardMestre();
    } catch (e) {
        console.error("Erro ao aprovar:", e);
        alert(`Erro ao aprovar (${e.code || 'erro'}): ${e.message}`);
    }
}
