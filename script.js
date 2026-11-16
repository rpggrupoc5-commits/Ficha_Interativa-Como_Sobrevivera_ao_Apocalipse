/* ==========================================
   INTERFACE E EXECUÇÃO DAS ROLAGENS
========================================== */

function rolagemAtualizarDestinatariosMestre() {
    const select = document.getElementById('rolagem-destinatario-mestre');
    if (!select) return;

    select.innerHTML = '<option value="">Selecione um jogador</option>';

    commJogadores.forEach(jogador => {
        const option = document.createElement('option');
        option.value = jogador.uid;
        option.textContent = jogador.nome || jogador.email || 'Jogador';
        select.appendChild(option);
    });
}

function rolagemAtualizarPrivacidadeMestre() {
    const privacidade = document.getElementById('rolagem-privacidade-mestre');
    const container = document.getElementById('rolagem-destinatario-container');

    if (!privacidade || !container) return;

    if (privacidade.value === 'jogador') {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
        document.getElementById('rolagem-destinatario-mestre').value = '';
    }
}

function rolagemGerarResultados(quantidade, lados) {
    const resultados = [];

    for (let i = 0; i < quantidade; i++) {
        resultados.push(Math.floor(Math.random() * lados) + 1);
    }

    return resultados;
}

async function rolagemExecutar(ehMestre) {
    if (!usuarioAtual) {
        alert('Você precisa estar conectado para rolar os dados.');
        return;
    }

    const prefixo = ehMestre ? 'mestre' : 'jogador';

    const quantidade = Number(
        document.getElementById(`rolagem-qtd-${prefixo}`).value
    );

    const lados = Number(
        document.getElementById(`rolagem-tipo-${prefixo}`).value
    );

    const botao = document.getElementById(
        `rolagem-executar-${prefixo}`
    );

    if (!quantidade || quantidade < 1 || quantidade > 10 ||
        ![4, 6, 8, 10, 12, 20, 100].includes(lados)) {
        alert('Configuração de dados inválida.');
        return;
    }

    let visibilidade = 'publica';
    let allowedUids = [usuarioAtual.uid];

    if (ehMestre) {
        const privacidade = document.getElementById(
            'rolagem-privacidade-mestre'
        ).value;

        if (privacidade === 'mestre') {
            visibilidade = 'privada';
        }

        if (privacidade === 'jogador') {
            const destinatario = document.getElementById(
                'rolagem-destinatario-mestre'
            ).value;

            if (!destinatario) {
                alert('Selecione o jogador que poderá ver esta rolagem.');
                return;
            }

            visibilidade = 'privada';
            allowedUids.push(destinatario);
        }
    } else {
        const privacidade = document.getElementById(
            'rolagem-privacidade-jogador'
        ).value;

        if (privacidade === 'mestre') {
            visibilidade = 'privada';
        }
    }

    const nomeRemetente = ehMestre
        ? 'Mestre'
        : (usuarioAtual.displayName ||
           usuarioAtual.email?.split('@')[0] ||
           'Jogador');

    botao.disabled = true;
    botao.textContent = 'ROLANDO...';

    try {
        const dados = rolagemGerarResultados(quantidade, lados);
        const total = dados.reduce((soma, valor) => soma + valor, 0);

        const expressao = `${quantidade}d${lados}`;

        await addDoc(collection(db, 'rolagens'), {
            remetenteUid: usuarioAtual.uid,
            remetenteNome: nomeRemetente,
            visibilidade,
            allowedUids,
            dados,
            expressao,
            total,
            criadoEm: serverTimestamp(),
            fechada: false,
            fechadaEm: null,
            fechadaPor: null
        });

        alert(
            `🎲 RESULTADO DA ROLAGEM\n\n` +
            `${nomeRemetente}\n` +
            `${expressao}\n\n` +
            `Dados: ${dados.join(' + ')}\n\n` +
            `TOTAL: ${total}`
        );

    } catch (erro) {
        console.error('Erro ao executar rolagem:', erro);
        alert(`Não foi possível realizar a rolagem: ${erro.message}`);
    } finally {
        botao.disabled = false;
        botao.textContent = '🎲 ROLAR DADOS';
    }
}

document.getElementById('rolagem-privacidade-mestre')
    ?.addEventListener('change', rolagemAtualizarPrivacidadeMestre);

document.getElementById('rolagem-executar-mestre')
    ?.addEventListener('click', () => rolagemExecutar(true));

document.getElementById('rolagem-executar-jogador')
    ?.addEventListener('click', () => rolagemExecutar(false));

document.getElementById('comm-modal-jogador')
    ?.addEventListener('transitionend', () => {});

rolagemAtualizarDestinatariosMestre();
