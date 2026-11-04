import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInAnonymously,
    onAuthStateChanged,
    signOut,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    collection,
    getDocs,
    query,
    where,
    limit,
    deleteDoc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAdjZy-eaJmeGlvvEMTQXDZmy5WOOKNoGg",
    authDomain: "painel-ficha-apocalipse.firebaseapp.com",
    projectId: "painel-ficha-apocalipse",
    storageBucket: "painel-ficha-apocalipse.firebasestorage.app",
    messagingSenderId: "277003324514",
    appId: "1:277003324514:web:80644b98aa895afdac553b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const DEBOUNCE_AUTOSAVE_MS = 30 * 1000;

let usuarioAtual = null;
let fichaAtualId = null;
let fichaAtualTipo = "jogador";
let fichaAtualProprietarioUid = null;
let fichaAtualCriadoPor = null;
let modoAcesso = "nenhum";
let ehConvidado = false;
let autosaveTimer = null;
let autosaveHabilitado = false;
let salvandoEmProgresso = false;
let ultimoEstadoSalvo = "";
let intervalMonitorRevogacao = null;
let tempoUltimoSomTecla = 0;

const emailMestre = "rpggrupoc5@gmail.com";

// ==========================================
// GERENCIADOR DE ÁUDIO
// ==========================================
const audioAbertura = new Audio('abertura.mp3');
const audioTecla = new Audio('tecla.mp3');
const audioClique = new Audio('clique.mp3');
const audioSalvarAuto = new Audio('salvar_auto.mp3');
const audioSalvarManual = new Audio('salvar_manual.mp3');
const audioEntrarFicha = new Audio('entrar_ficha.mp3');
const audioSairFicha = new Audio('sair_ficha.mp3');
const audioEntrarPainel = new Audio('entrar_painel.mp3');
const audioSairPainel = new Audio('sair_painel.mp3');
const audioCancelarItem = new Audio('cancelar_item.mp3');

audioAbertura.volume = 1.0; 
audioTecla.volume = 0.4; 
audioClique.volume = 0.7;
audioSalvarAuto.volume = 0.8;
audioSalvarManual.volume = 0.9;
audioEntrarFicha.volume = 0.8;
audioSairFicha.volume = 0.8;
audioEntrarPainel.volume = 0.8;
audioSairPainel.volume = 0.8;
audioCancelarItem.volume = 0.8;

function tocarSom(audio, pausarAnterior = true) {
    if (!audio) return;
    try {
        if (pausarAnterior) audio.currentTime = 0;
        audio.play().catch(e => {});
    } catch (e) {}
}

function tocarSomTecla() {
    const agora = Date.now();
    if (agora - tempoUltimoSomTecla > 50) {
        tocarSom(audioTecla, true);
        tempoUltimoSomTecla = agora;
    }
}

// ==========================================
// COMPRESSÃO DE IMAGEM (GIF SALVO DIRETO)
// ==========================================
function comprimirImagem(file) {
    return new Promise((resolve, reject) => {
        if (file.type === 'image/gif') {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error("Erro ao ler o GIF"));
            reader.readAsDataURL(file);
        } else {
            const reader = new FileReader();
            reader.onload = (event) => {
                const imagem = new Image();
                imagem.onload = () => {
                    const limite = 1000;
                    let largura = imagem.width, altura = imagem.height;
                    if (largura > limite || altura > limite) {
                        const proporcao = Math.min(limite / largura, limite / altura);
                        largura = Math.round(largura * proporcao);
                        altura = Math.round(altura * proporcao);
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = largura; canvas.height = altura;
                    const contexto = canvas.getContext('2d');
                    contexto.drawImage(imagem, 0, 0, largura, altura);
                    resolve(canvas.toDataURL('image/webp', 0.78));
                };
                imagem.onerror = () => reject(new Error("Não foi possível processar esta imagem."));
                imagem.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
}

window.abrirSeletor = function(callback) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        if (!file.type.startsWith('image/')) { alert("Selecione um arquivo de imagem."); return; }
        try {
            const imagemComprimida = await comprimirImagem(file);
            callback(imagemComprimida);
        } catch (erro) { console.error(erro); alert("Não foi possível preparar a imagem."); }
    };
    input.click();
};

// ==========================================
// LÓGICA DE LOGIN E SEGURANÇA
// ==========================================

const forca = document.getElementById('forca');
const destreza = document.getElementById('destreza');
const forcaAcao = document.getElementById('forca-acao');
const destrezaAcao = document.getElementById('destreza-acao');

function calcular() {
    if (forca.value) forcaAcao.value = parseInt(forca.value) * 3;
    if (destreza.value) destrezaAcao.value = parseInt(destreza.value) * 3;
}
if (forca) forca.addEventListener('input', calcular);
if (destreza) destreza.addEventListener('input', calcular);

const telaLogin = document.getElementById('tela-login');
const sitePrincipal = document.getElementById('site-principal');
const mensagemErro = document.getElementById('mensagem-erro');

document.getElementById('toggle-senha').onclick = () => {
    const inputSenha = document.getElementById('login-senha');
    const icone = document.querySelector('#toggle-senha i');
    if (inputSenha.type === 'password') {
        inputSenha.type = 'text';
        icone.classList.remove('fa-eye');
        icone.classList.add('fa-eye-slash');
    } else {
        inputSenha.type = 'password';
        icone.classList.remove('fa-eye-slash');
        icone.classList.add('fa-eye');
    }
};

document.getElementById('btn-esqueci-senha').onclick = () => {
    const email = document.getElementById('login-email').value.trim();
    if (!email) return alert("Digite seu e-mail no campo acima para recuperar a senha.");
    sendPasswordResetEmail(auth, email)
        .then(() => alert(`E-mail de recuperação enviado para ${email}. Verifique sua caixa de entrada e spam.`))
        .catch((error) => alert(`Erro ao enviar e-mail: ${error.message}`));
};

document.getElementById('btn-entrar').onclick = () => {
    tocarSom(audioAbertura);
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    mensagemErro.classList.add('hidden');
    
    signInWithEmailAndPassword(auth, email, senha).catch((error) => {
        console.error("Falha no login Firebase:", error);
        mensagemErro.innerText = `Erro no login (${error.code || "desconhecido"}): ${error.message}`;
        mensagemErro.classList.remove('hidden');
    });
};

document.getElementById('btn-cadastrar').onclick = () => {
    tocarSom(audioClique);
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    mensagemErro.classList.add('hidden');
    createUserWithEmailAndPassword(auth, email, senha).then(() => {
        alert("Conta criada! Você já pode fazer login.");
    }).catch((error) => {
        console.error("Falha no cadastro Firebase:", error);
        mensagemErro.innerText = `Erro no cadastro (${error.code || "desconhecido"}): ${error.message}`;
        mensagemErro.classList.remove('hidden');
    });
};

document.getElementById('btn-sair').onclick = () => {
    tocarSom(audioSairFicha);
    signOut(auth).then(() => window.location.reload());
};

function parametros() {
    return new URLSearchParams(window.location.search);
}
function ehConvite() {
    return parametros().get('convite') === '1';
}
function fichaSolicitada() {
    return parametros().get('ficha');
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioAtual = user;
        const mestreLogado = (user.email || '').trim().toLowerCase() === emailMestre.toLowerCase();

        if (user.email) {
            try {
                await registrarContaJogador(user);
            } catch (erroPerfil) {
                console.error('Não foi possível registrar o perfil da conta:', erroPerfil);
            }
        }

        const fichaId = fichaSolicitada();
        const convite = ehConvite();

        telaLogin.classList.add('hidden');
        sitePrincipal.classList.remove('hidden');

        if (fichaId) {
            await abrirRotaFicha(fichaId, convite);
            return;
        }

        if (mestreLogado) {
            document.getElementById('dashboard-mestre').classList.remove('hidden');
            document.getElementById('dashboard-jogador').classList.add('hidden');
            document.getElementById('area-ficha').classList.add('hidden');
            tocarSom(audioEntrarPainel);
            carregarDashboardMestre();
        } else {
            document.getElementById('dashboard-jogador').classList.remove('hidden');
            document.getElementById('dashboard-mestre').classList.add('hidden');
            document.getElementById('area-ficha').classList.add('hidden');
            tocarSom(audioEntrarPainel);
            carregarDashboardJogador();
        }
    } else {
        usuarioAtual = null;
        if (ehConvite() && fichaSolicitada()) {
            try {
                await signInAnonymously(auth);
            } catch (e) {
                console.error("Falha no login anônimo:", e);
                alert(`Não foi possível entrar como convidado (${e.code || 'erro'}): ${e.message}. Verifique se a autenticação anônima está habilitada no Firebase.`);
            }
            return;
        }
        telaLogin.classList.remove('hidden');
        sitePrincipal.classList.add('hidden');
    }
});

async function abrirRotaFicha(fichaId, veioDeConvite) {
    tocarSom(audioEntrarFicha);
    mostrarAreaFicha();
    fichaAtualId = fichaId;
    const mestreLogado = (usuarioAtual.email || '').trim().toLowerCase() === emailMestre.toLowerCase();

    if (mestreLogado) {
        modoAcesso = "mestre";
        ehConvidado = false;
        try {
            await carregarFicha();
            aplicarPermissoesNaTela();
            configurarAutosave();
        } catch (e) {
            alert(`Erro ao carregar ficha (${e.code || 'desconhecido'}): ${e.message}`);
        }
        return;
    }

    if (fichaId === usuarioAtual.uid) {
        modoAcesso = "dono";
        ehConvidado = false;
        try {
            await carregarFicha();
            aplicarPermissoesNaTela();
            configurarAutosave();
        } catch (e) {
            alert(`Erro ao carregar ficha (${e.code || 'desconhecido'}): ${e.message}`);
        }
        return;
    }

    const acessoSnap = await getDoc(doc(db, 'fichas', fichaId, 'acessos', usuarioAtual.uid));
    if (acessoSnap.exists()) {
        const permissao = acessoSnap.data().permissao || "visualizar";
        modoAcesso = permissao === "editar" ? "convidado-editar" : "convidado-visualizar";
        ehConvidado = true;
        try {
            await carregarFicha();
            aplicarPermissoesNaTela();
            mostrarBannerConvidado(`Acesso como <b>${permissao === 'editar' ? 'EDITOR' : 'VISUALIZADOR'}</b>.<br><span class="text-sm">Seu UID: ${usuarioAtual.uid}</span>`);
            if (modoAcesso === "convidado-editar") configurarAutosave();
            monitorarRevogacao(fichaId);
        } catch (e) {
            alert(`Erro ao carregar ficha (${e.code || 'desconhecido'}): ${e.message}`);
        }
        return;
    }

    try {
        const donoSnap = await getDoc(doc(db, 'fichas', fichaId));
        if (donoSnap.exists() && donoSnap.data().proprietarioUid === usuarioAtual.uid) {
            modoAcesso = "dono";
            ehConvidado = false;
            await carregarFicha();
            aplicarPermissoesNaTela();
            configurarAutosave();
            return;
        }
    } catch (e) {}

    if (veioDeConvite || ehConvidado) {
        modoAcesso = "convidado-pendente";
        ehConvidado = true;
        await verificarSolicitacaoExistente(fichaId);
    } else {
        modoAcesso = "nenhum";
        alert("Você não tem permissão para abrir esta ficha.");
        window.location.href = window.location.pathname;
    }
}

// MONITORAMENTO INTELIGENTE (REVOGAÇÃO E MUDANÇA DE PERMISSÃO)
function monitorarRevogacao(fichaId) {
    if (intervalMonitorRevogacao) clearInterval(intervalMonitorRevogacao);
    intervalMonitorRevogacao = setInterval(async () => {
        try {
            const snap = await getDoc(doc(db, 'fichas', fichaId, 'acessos', usuarioAtual.uid));
            
            // Se o acesso foi deletado (revogado)
            if (!snap.exists()) {
                clearInterval(intervalMonitorRevogacao);
                desativarAutosave();
                document.querySelectorAll('#area-ficha input, #area-ficha textarea').forEach(el => el.disabled = true);
                document.getElementById('btn-salvar-ficha').classList.add('hidden');
                const banner = document.getElementById('banner-convidado');
                if (banner) banner.innerHTML = '<div class="painel-papel p-3 text-[#a81c1c] font-bold text-center rounded">ACESSO REVOGADO — solicite novamente ao mestre.</div>';
                alert('Seu acesso a esta ficha foi revogado pelo mestre.');
                return;
            }

            // Se o acesso existe, mas a permissão mudou (ex: de editar para visualizar)
            const novaPermissao = snap.data().permissao || "visualizar";
            const permissaoAtualMapeada = modoAcesso === "convidado-editar" ? "editar" : "visualizar";
            
            if (novaPermissao !== permissaoAtualMapeada) {
                clearInterval(intervalMonitorRevogacao);
                alert(`O mestre alterou sua permissão para ${novaPermissao.toUpperCase()}. A página será recarregada.`);
                window.location.reload(); // Recarrega para aplicar as novas regras
            }

        } catch (e) {}
    }, 5000);
}

async function verificarSolicitacaoExistente(fichaId) {
    try {
        const solSnap = await getDoc(doc(db, 'fichas', fichaId, 'solicitacoes', usuarioAtual.uid));
        if (solSnap.exists()) {
            const status = solSnap.data().status;
            if (status === 'recusado') {
                modoAcesso = "convidado-recusado";
                mostrarTelaSolicitacao('recusado');
            } else {
                mostrarTelaSolicitacao('pendente');
            }
        } else {
            mostrarTelaSolicitacao('sem-solicitacao');
        }
    } catch (e) {
        console.warn("Não foi possível verificar solicitação:", e);
        mostrarTelaSolicitacao('sem-solicitacao');
    }
}

function mostrarTelaSolicitacao(estado) {
    const area = document.getElementById('area-ficha');
    let painel = document.getElementById('painel-solicitacao');

    if (!painel) {
        painel = document.createElement('div');
        painel.id = 'painel-solicitacao';
        painel.className = 'fixed inset-0 bg-black/90 z-40 flex justify-center items-center p-4';
        area.appendChild(painel);
    }
    painel.classList.remove('hidden');

    if (estado === 'sem-solicitacao') {
        painel.innerHTML = `
            <div class="painel-papel p-6 rounded-lg w-[420px] max-w-full flex flex-col gap-4">
                <h2 class="fonte-titulo text-3xl text-[#111] text-center">ACESSO À FICHA</h2>
                <p class="text-[#111] text-center font-bold">Você está abrindo esta ficha como <b>convidado</b>. É necessário solicitar autorização ao mestre.</p>
                <p class="text-[#111] text-center font-bold">Seu UID: ${usuarioAtual.uid}</p>
                <button id="btn-solicitar-acesso" class="w-full bg-[#a81c1c] text-white p-3 rounded font-bold hover:brightness-125">SOLICITAR ACESSO</button>
                <button id="btn-voltar-login" class="w-full bg-[#3a2e27] text-white p-3 rounded font-bold hover:bg-[#7a4e32]">VOLTAR</button>
            </div>
        `;
        document.getElementById('btn-solicitar-acesso').onclick = () => { tocarSom(audioClique); solicitarAcesso(); };
        document.getElementById('btn-voltar-login').onclick = () => { tocarSom(audioSairFicha); window.location.href = window.location.pathname; };
    } else if (estado === 'pendente') {
        painel.innerHTML = `
            <div class="painel-papel p-6 rounded-lg w-[420px] max-w-full flex flex-col gap-4">
                <h2 class="fonte-titulo text-3xl text-[#111] text-center">AGUARDANDO APROVAÇÃO</h2>
                <p class="text-[#111] text-center font-bold">Sua solicitação foi enviada ao mestre. Aguarde a aprovação para acessar a ficha.</p>
                <p class="text-[#111] text-center font-bold">Seu UID: ${usuarioAtual.uid}</p>
                <button id="btn-verificar" class="w-full bg-[#a81c1c] text-white p-3 rounded font-bold hover:brightness-125">VERIFICAR NOVAMENTE</button>
                <button id="btn-voltar-login" class="w-full bg-[#3a2e27] text-white p-3 rounded font-bold hover:bg-[#7a4e32]">SAIR</button>
            </div>
        `;
        document.getElementById('btn-verificar').onclick = () => { tocarSom(audioClique); window.location.reload(); };
        document.getElementById('btn-voltar-login').onclick = () => { tocarSom(audioSairFicha); signOut(auth).then(() => window.location.reload()); };
    } else if (estado === 'recusado') {
        painel.innerHTML = `
            <div class="painel-papel p-6 rounded-lg w-[420px] max-w-full flex flex-col gap-4">
                <h2 class="fonte-titulo text-3xl text-[#111] text-center">ACESSO RECUSADO</h2>
                <p class="text-[#111] text-center font-bold">O mestre recusou sua solicitação de acesso a esta ficha.</p>
                <button id="btn-voltar-login" class="w-full bg-[#3a2e27] text-white p-3 rounded font-bold hover:bg-[#7a4e32]">SAIR</button>
            </div>
        `;
        document.getElementById('btn-voltar-login').onclick = () => { tocarSom(audioSairFicha); signOut(auth).then(() => window.location.reload()); };
    }
}

async function solicitarAcesso() {
    if (!usuarioAtual || !fichaAtualId) return;
    const btn = document.getElementById('btn-solicitar-acesso');
    if (btn) { btn.disabled = true; btn.innerText = "ENVIANDO..."; }
    try {
        await setDoc(doc(db, 'fichas', fichaAtualId, 'solicitacoes', usuarioAtual.uid), {
            uidConvidado: usuarioAtual.uid,
            fichaId: fichaAtualId,
            status: 'pendente',
            criadoEm: new Date().toISOString()
        });
        mostrarTelaSolicitacao('pendente');
    } catch (e) {
        console.error("Erro ao solicitar acesso:", e);
        alert(`Não foi possível enviar a solicitação (${e.code || 'erro'}): ${e.message}`);
        if (btn) { btn.disabled = false; btn.innerText = "SOLICITAR ACESSO"; }
    }
}

function aplicarPermissoesNaTela() {
    const btnSalvar = document.getElementById('btn-salvar-ficha');
    const inputsEditaveis = document.querySelectorAll('#area-ficha input, #area-ficha textarea');
    const slots = document.querySelectorAll('#area-ficha .slot-vazio, #area-ficha .foto-personagem');

    if (modoAcesso === "convidado-visualizar") {
        if (btnSalvar) btnSalvar.classList.add('hidden');
        inputsEditaveis.forEach(el => {
            el.disabled = true;
            el.classList.add('opacity-80', 'cursor-not-allowed');
        });
        slots.forEach(el => { el.onclick = null; el.style.pointerEvents = 'none'; });
        document.getElementById('btn-voltar-painel').classList.add('hidden');
    } else if (modoAcesso === "convidado-editar") {
        document.getElementById('btn-voltar-painel').classList.add('hidden');
        if (btnSalvar) btnSalvar.classList.remove('hidden');
    } else if (modoAcesso === "mestre" || modoAcesso === "dono") {
        document.getElementById('btn-voltar-painel').classList.remove('hidden');
        if (btnSalvar) btnSalvar.classList.remove('hidden');
    }
}

function mostrarBannerConvidado(html) {
    let banner = document.getElementById('banner-convidado');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'banner-convidado';
        banner.className = 'max-w-[1500px] mx-auto mt-4 px-3';
        const area = document.getElementById('area-ficha');
        area.insertBefore(banner, area.firstChild);
    }
    banner.innerHTML = `<div class="painel-papel p-3 text-[#111] font-bold text-center rounded">${html}</div>`;
}

function mostrarAreaFicha() {
    document.getElementById('dashboard-jogador').classList.add('hidden');
    document.getElementById('dashboard-mestre').classList.add('hidden');
    document.getElementById('area-ficha').classList.remove('hidden');
}

function configurarAutosave() {
    if (modoAcesso === "convidado-visualizar") return;
    autosaveHabilitado = true;
    
    let indicador = document.getElementById('indicador-autosave');
    if (!indicador) {
        indicador = document.createElement('div');
        indicador.id = 'indicador-autosave';
        indicador.className = 'fixed bottom-4 right-4 z-50 px-4 py-2 rounded font-bold shadow-lg text-white transition-opacity';
        indicador.style.opacity = '0';
        document.body.appendChild(indicador);
    }
    
    document.querySelectorAll('#area-ficha input, #area-ficha textarea, #modal-item input, #modal-item textarea, #modal-foto input, #modal-foto textarea').forEach(el => {
        el.addEventListener('input', () => {
            tocarSomTecla();
            agendarAutosave();
        });
        el.addEventListener('change', agendarAutosave);
    });

    document.querySelectorAll('#area-ficha .slot-vazio, #area-ficha .foto-personagem').forEach(el => {
        el.addEventListener('click', agendarAutosave);
    });
    window.addEventListener('beforeunload', () => {
        if (autosaveHabilitado) salvarFicha({ silencioso: true, semAlerta: true });
    });
}

function desativarAutosave() {
    autosaveHabilitado = false;
    if (autosaveTimer) { clearTimeout(autosaveTimer); autosaveTimer = null; }
}

function agendarAutosave() {
    if (!autosaveHabilitado) return;
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => salvarFicha({ silencioso: true }), DEBOUNCE_AUTOSAVE_MS);
}

function mostrarIndicador(texto, cor) {
    const ind = document.getElementById('indicador-autosave');
    if (!ind) return;
    ind.textContent = texto;
    ind.className = `fixed bottom-4 right-4 z-50 px-4 py-2 rounded font-bold shadow-lg text-white transition-opacity ${cor}`;
    ind.style.opacity = '1';
    if (texto.startsWith('Salvo') || texto.startsWith('Erro')) {
        setTimeout(() => { ind.style.opacity = '0'; }, 3000);
    }
}

window.uploadFoto = function(elemento) {
    if (modoAcesso === "convidado-visualizar") return;
    abrirModalFoto(elemento);
};

function abrirModalFoto(elemento) {
    tocarSom(audioClique);
    const imgAtual = elemento.querySelector('img');
    const dadosAtuais = imgAtual ? { img: imgAtual.getAttribute('src') } : {};
    quadradoFotoAtual = elemento;
    inputFotoNome.value = elemento.getAttribute('data-nome-foto') || '';
    inputFotoDesc.value = elemento.getAttribute('data-desc-foto') || '';
    imagemFotoBase64 = dadosAtuais.img || null;
    atualizarPreviewFoto();
    modalFoto.classList.remove('hidden');
}

function atualizarPreviewFoto() {
    if (imagemFotoBase64) {
        previewFoto.innerHTML = `<img src="${imagemFotoBase64}" style="width:100%;height:100%;object-fit:cover;object-position:top center;">
            <button id="btn-remover-img-foto" class="absolute top-1 right-1 bg-red-800 text-white rounded-full w-5 h-5 flex items-center justify-center cursor-pointer z-20 text-[10px] font-bold">X</button>`;
        previewFoto.classList.remove('border-dashed');
        previewFoto.classList.add('border-solid');
        document.getElementById('btn-remover-img-foto').onclick = (e) => {
            e.preventDefault(); imagemFotoBase64 = null; atualizarPreviewFoto();
        };
    } else {
        previewFoto.innerHTML = `<i class="fa-solid fa-camera text-2xl mb-1"></i><span class="text-[9px] font-bold text-center leading-tight">SEM IMAGEM</span>`;
        previewFoto.classList.add('border-dashed');
        previewFoto.classList.remove('border-solid');
    }
}

const gridInv = document.getElementById('inventario');
const espacosEl = document.getElementById('espacos');
const pesoEl = document.getElementById('peso-total');
const pesoPersonagemEl = document.getElementById('peso-total-personagem');
const pesoTotalGeralEl = document.getElementById('peso-total-geral');
const pesoPersonagemInput = document.getElementById('peso-personagem');

let quadradoAtual = null;
let imagemAtualBase64 = null;
let quadradoFotoAtual = null;
let imagemFotoBase64 = null;

function calcularPesoGeral() {
    let pesoItens = 0;
    document.querySelectorAll('.item-adicionado').forEach(item => {
        const qtd = parseFloat(item.dataset.qtd) || 1;
        const pesoStr = (item.dataset.peso || "0").toString().replace(',', '.');
        pesoItens += qtd * (parseFloat(pesoStr) || 0);
    });
    if (pesoEl) pesoEl.innerText = pesoItens.toFixed(2);

    let pesoEquip = 0;
    document.querySelectorAll('.slot-vazio.item-adicionado').forEach(item => {
        if (item.id === 'foto-personagem') return;
        const qtd = parseFloat(item.dataset.qtd) || 1;
        const pesoStr = (item.dataset.peso || "0").toString().replace(',', '.');
        pesoEquip += qtd * (parseFloat(pesoStr) || 0);
    });

    const pesoPers = parseFloat((pesoPersonagemInput?.value || '0').toString().replace(',', '.')) || 0;
    if (pesoPersonagemEl) pesoPersonagemEl.innerText = (pesoPers + pesoEquip).toFixed(2);
    if (pesoTotalGeralEl) pesoTotalGeralEl.innerText = (pesoPers + pesoEquip + pesoItens).toFixed(2);
    if (espacosEl) espacosEl.innerText = document.querySelectorAll('#inventario .item-adicionado').length;
}

if (pesoPersonagemInput) pesoPersonagemInput.addEventListener('input', calcularPesoGeral);

const modalHTML = `
    <div id="modal-item" class="fixed inset-0 bg-black/80 z-50 flex justify-center items-center hidden">
        <div class="painel-papel p-6 rounded-lg w-[400px] flex flex-col gap-3 relative">
            <h3 class="fonte-titulo text-2xl text-[#111] border-b border-black/30 pb-2 mb-2">DADOS DO ITEM</h3>
            <div class="flex gap-4">
                <div id="modal-preview" class="w-24 h-24 rounded flex flex-col justify-center items-center relative overflow-hidden text-black/30 border-2 border-dashed border-[#3a2e27] bg-black/10">
                    <i class="fa-solid fa-camera text-2xl mb-1"></i>
                    <span class="text-[9px] font-bold text-center leading-tight">SEM IMAGEM</span>
                </div>
                <div class="flex-1 flex flex-col gap-2">
                    <label class="flex flex-col text-sm font-bold text-[#111]">Nome do Item:<input type="text" id="modal-nome" class="input-campo p-2"></label>
                    <button id="btn-upload" class="bg-[#3a2e27] text-white p-2 rounded font-bold hover:bg-[#a81c1c] transition text-sm"><i class="fa-solid fa-camera"></i> Escolher Imagem</button>
                </div>
            </div>
            <div class="flex gap-2">
                <label class="flex flex-col text-sm font-bold text-[#111] flex-1">Quantidade:<input type="number" id="modal-qtd" value="1" class="input-campo p-2"></label>
                <label class="flex flex-col text-sm font-bold text-[#111] flex-1">Peso Unit. (kg):<input type="text" id="modal-peso" class="input-campo p-2" placeholder="Ex: 0.5"></label>
            </div>
            <label class="flex flex-col text-sm font-bold text-[#111]">Descrição:<textarea id="modal-desc" class="input-campo p-2 resize-none h-16"></textarea></label>
            <div class="flex justify-between mt-2 gap-2">
                <button id="btn-excluir" class="bg-gray-600 text-white p-2 rounded font-bold flex-1 hover:bg-gray-700 hidden">Excluir</button>
                <button id="btn-cancelar" class="bg-gray-600 text-white p-2 rounded font-bold flex-1 hover:bg-gray-700">Cancelar</button>
                <button id="btn-salvar-item" class="bg-[#a81c1c] text-white p-2 rounded font-bold flex-1 hover:brightness-125">Salvar</button>
            </div>
        </div>
    </div>

    <div id="modal-foto" class="fixed inset-0 bg-black/80 z-50 flex justify-center items-center hidden">
        <div class="painel-papel p-6 rounded-lg w-[400px] flex flex-col gap-3 relative">
            <h3 class="fonte-titulo text-2xl text-[#111] border-b border-black/30 pb-2 mb-2">FOTO DO PERSONAGEM</h3>
            <div class="flex gap-4">
                <div id="modal-preview-foto" class="w-24 h-32 rounded flex flex-col justify-center items-center relative overflow-hidden text-black/30 border-2 border-dashed border-[#3a2e27] bg-black/10">
                    <i class="fa-solid fa-camera text-2xl mb-1"></i>
                    <span class="text-[9px] font-bold text-center leading-tight">SEM IMAGEM</span>
                </div>
                <div class="flex-1 flex flex-col gap-2">
                    <label class="flex flex-col text-sm font-bold text-[#111]">Nome (opcional):<input type="text" id="modal-foto-nome" class="input-campo p-2" placeholder="Nome do personagem"></label>
                    <button id="btn-upload-foto" class="bg-[#3a2e27] text-white p-2 rounded font-bold hover:bg-[#a81c1c] transition text-sm"><i class="fa-solid fa-camera"></i> Escolher Imagem</button>
                </div>
            </div>
            <label class="flex flex-col text-sm font-bold text-[#111]">Descrição:<textarea id="modal-foto-desc" class="input-campo p-2 resize-none h-16"></textarea></label>
            <div class="flex justify-between mt-2 gap-2">
                <button id="btn-excluir-foto" class="bg-gray-600 text-white p-2 rounded font-bold flex-1 hover:bg-gray-700 hidden">Excluir</button>
                <button id="btn-cancelar-foto" class="bg-gray-600 text-white p-2 rounded font-bold flex-1 hover:bg-gray-700">Cancelar</button>
                <button id="btn-salvar-foto" class="bg-[#a81c1c] text-white p-2 rounded font-bold flex-1 hover:brightness-125">Salvar</button>
            </div>
        </div>
    </div>
`;
document.body.insertAdjacentHTML('beforeend', modalHTML);

const modal = document.getElementById('modal-item');
const modalPreview = document.getElementById('modal-preview');
const inputNome = document.getElementById('modal-nome');
const inputQtd = document.getElementById('modal-qtd');
const inputPeso = document.getElementById('modal-peso');
const inputDesc = document.getElementById('modal-desc');
const btnExcluir = document.getElementById('btn-excluir');
const btnCancelar = document.getElementById('btn-cancelar');
const btnSalvarItem = document.getElementById('btn-salvar-item');
const btnUpload = document.getElementById('btn-upload');

const modalFoto = document.getElementById('modal-foto');
const previewFoto = document.getElementById('modal-preview-foto');
const inputFotoNome = document.getElementById('modal-foto-nome');
const inputFotoDesc = document.getElementById('modal-foto-desc');
const btnExcluirFoto = document.getElementById('btn-excluir-foto');
const btnCancelarFoto = document.getElementById('btn-cancelar-foto');
const btnSalvarFoto = document.getElementById('btn-salvar-foto');
const btnUploadFoto = document.getElementById('btn-upload-foto');

const fotoContainer = document.getElementById('foto-personagem');
if (fotoContainer) {
    fotoContainer.onclick = null; 
    fotoContainer.addEventListener('click', (e) => {
        if (e.target.closest('#btn-remover-img-modal')) return;
        window.uploadFoto(fotoContainer);
    });
}

btnCancelarFoto.onclick = () => { tocarSom(audioCancelarItem); modalFoto.classList.add('hidden'); };
btnUploadFoto.onclick = () => {
    window.abrirSeletor((img) => { imagemFotoBase64 = img; atualizarPreviewFoto(); });
};
btnExcluirFoto.onclick = () => {
    if (!quadradoFotoAtual) return;
    tocarSom(audioSairPainel);
    quadradoFotoAtual.innerHTML = '<i class="fa-solid fa-camera text-4xl text-black/20 mb-2"></i><span>FOTO DO<br>PERSONAGEM</span><div class="texto-proporcao">PROPORÇÃO IDEAL: 9x16</div>';
    quadradoFotoAtual.removeAttribute('data-nome-foto');
    quadradoFotoAtual.removeAttribute('data-desc-foto');
    modalFoto.classList.add('hidden');
    agendarAutosave();
};
btnSalvarFoto.onclick = () => {
    if (!quadradoFotoAtual) return;
    if (!imagemFotoBase64) return alert("Escolha uma imagem.");
    tocarSom(audioClique);
    quadradoFotoAtual.innerHTML = `<img src="${imagemFotoBase64}" style="width:100%;height:100%;object-fit:cover;object-position:top center;position:absolute;top:0;left:0;z-index:1;pointer-events:none;">`;
    quadradoFotoAtual.setAttribute('data-nome-foto', inputFotoNome.value || '');
    quadradoFotoAtual.setAttribute('data-desc-foto', inputFotoDesc.value || '');
    modalFoto.classList.add('hidden');
    agendarAutosave();
};

function atualizarPreviewModal() {
    if (imagemAtualBase64) {
        modalPreview.innerHTML = `
            <img src="${imagemAtualBase64}" style="width:100%;height:100%;object-fit:contain;padding:4px;">
            <button id="btn-remover-img-modal" class="absolute top-1 right-1 bg-red-800 text-white rounded-full w-5 h-5 flex items-center justify-center cursor-pointer z-20 text-[10px] font-bold">X</button>
        `;
        modalPreview.classList.remove('border-dashed');
        modalPreview.classList.add('border-solid');
        document.getElementById('btn-remover-img-modal').onclick = (e) => {
            e.preventDefault(); imagemAtualBase64 = null; atualizarPreviewModal();
        };
    } else {
        modalPreview.innerHTML = `<i class="fa-solid fa-camera text-2xl mb-1"></i><span class="text-[9px] font-bold text-center leading-tight">SEM IMAGEM</span>`;
        modalPreview.classList.add('border-dashed');
        modalPreview.classList.remove('border-solid');
    }
}

function abrirModal(q, dados = null) {
    if (modoAcesso === "convidado-visualizar") return;
    tocarSom(audioClique);
    quadradoAtual = q;
    if (dados && dados.nome) {
        inputNome.value = dados.nome;
        inputQtd.value = dados.qtd;
        inputPeso.value = dados.peso;
        inputDesc.value = dados.desc || "";
        imagemAtualBase64 = dados.img || null;
        btnExcluir.classList.remove('hidden');
        document.querySelector('#modal-item h3').innerText = "EDITAR ITEM";
        btnSalvarItem.innerText = "SALVAR";
    } else {
        inputNome.value = ""; inputQtd.value = 1; inputPeso.value = ""; inputDesc.value = "";
        imagemAtualBase64 = null;
        btnExcluir.classList.add('hidden');
        document.querySelector('#modal-item h3').innerText = "NOVO ITEM";
        btnSalvarItem.innerText = "ADICIONAR";
    }
    atualizarPreviewModal();
    modal.classList.remove('hidden');
}

btnCancelar.onclick = () => { tocarSom(audioCancelarItem); modal.classList.add('hidden'); };
btnUpload.onclick = () => {
    window.abrirSeletor((img) => { imagemAtualBase64 = img; atualizarPreviewModal(); });
};

btnExcluir.onclick = () => {
    tocarSom(audioSairPainel);
    if (quadradoAtual.id.startsWith('inv-')) {
        quadradoAtual.innerHTML = '<span class="text-2xl text-black/20 group-hover:text-red-800 transition-colors">+</span>';
    } else {
        const original = quadradoAtual.getAttribute('data-original') || '';
        quadradoAtual.innerHTML = original + '<span class="text-lg text-black/30"><i class="fa-solid fa-upload"></i></span>';
    }
    quadradoAtual.classList.remove('item-adicionado');
    quadradoAtual.removeAttribute('data-itemData');
    quadradoAtual.removeAttribute('data-peso');
    quadradoAtual.removeAttribute('data-qtd');
    calcularPesoGeral();
    modal.classList.add('hidden');
    agendarAutosave();
};

btnSalvarItem.onclick = () => {
    const nome = inputNome.value;
    const pesoString = inputPeso.value.replace(',', '.');
    const qtd = parseInt(inputQtd.value) || 0;
    if (!imagemAtualBase64) return alert("Escolha uma imagem.");
    if (!nome.trim()) return alert("Digite o nome.");
    if (qtd <= 0) return alert("Quantidade > 0.");
    if (inputPeso.value.trim() === "") return alert("Digite o peso.");
    
    tocarSom(audioEntrarPainel);
    const dados = { img: imagemAtualBase64, nome, qtd, peso: pesoString, desc: inputDesc.value };
    renderizarItem(quadradoAtual, dados);
    calcularPesoGeral();
    modal.classList.add('hidden');
    agendarAutosave();
};

function renderizarItem(q, dados) {
    const isEquipamento = !q.id.startsWith('inv-');
    const classeTexto = isEquipamento ? 'opacity-0 group-hover:opacity-100 transition-opacity' : 'opacity-100';
    q.innerHTML = `
        ${dados.img ? `<img src="${dados.img}" style="width:100%;height:100%;object-fit:contain;position:absolute;top:0;left:0;padding:4px;z-index:1;">` : ''}
        <div class="text-[10px] font-bold bg-black/40 text-white px-1 rounded leading-tight w-full absolute bottom-0 left-0 z-10 text-center ${classeTexto}">
            ${dados.nome} <br>
            <span class="text-gray-300">Qtd: ${dados.qtd}</span> |
            <span class="text-gray-300">${dados.peso}kg</span>
        </div>
        <div class="absolute inset-0 bg-black/80 text-white text-[10px] p-1 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center pointer-events-none z-20">
            <span class="font-bold mb-1">EDITAR</span>
            ${dados.desc ? `<span class="italic text-gray-300 truncate w-full text-center">"${dados.desc}"</span>` : ''}
        </div>
    `;
    q.classList.add('item-adicionado');
    q.dataset.itemData = JSON.stringify(dados);
    q.dataset.peso = dados.peso;
    q.dataset.qtd = dados.qtd;
}

if (gridInv) {
    for (let i = 0; i < 16; i++) {
        const q = document.createElement('div');
        q.id = `inv-${i}`;
        q.className = 'slot-vazio rounded aspect-square flex flex-col justify-center items-center relative text-center p-1 overflow-hidden group';
        q.innerHTML = '<span class="text-2xl text-black/20 group-hover:text-red-800 transition-colors">+</span>';
        q.onclick = () => {
            if (q.classList.contains('item-adicionado')) abrirModal(q, JSON.parse(q.dataset.itemData));
            else abrirModal(q);
        };
        gridInv.appendChild(q);
    }
}

const slotsEquipamento = document.querySelectorAll('.slot-vazio:not(#inventario .slot-vazio)');
slotsEquipamento.forEach(slot => {
    if (!slot.classList.contains('foto-personagem')) {
        slot.setAttribute('data-original', slot.innerHTML.split('<span')[0]);
        slot.removeAttribute('onclick');
        slot.onclick = () => {
            if (slot.classList.contains('item-adicionado')) abrirModal(slot, JSON.parse(slot.dataset.itemData));
            else abrirModal(slot);
        };
    }
});

const listaT = document.getElementById('talentos');
if (listaT) {
    for (let i = 1; i <= 20; i++) {
        const l = document.createElement('div');
        l.className = 'flex items-center gap-2 border-b border-black/20 pb-1';
        l.innerHTML = `<span class="font-bold w-5 text-right text-[#111] text-sm">${i}.</span><input type="text" class="bg-transparent border-none outline-none font-semibold text-[#111] text-base w-full">`;
        listaT.appendChild(l);
    }
}

async function salvarImagemSeparada(idImagem, dadosImagem) {
    if (!dadosImagem) return;
    await setDoc(doc(db, "fichas", fichaAtualId, "imagens", idImagem), { imagem: dadosImagem });
}

async function carregarImagensSeparadas() {
    const snapshot = await getDocs(collection(db, "fichas", fichaAtualId, "imagens"));
    const imagens = {};
    snapshot.forEach(documento => { imagens[documento.id] = documento.data().imagem || ""; });
    return imagens;
}

async function salvarFicha(opcoes = {}) {
    if (!usuarioAtual || !fichaAtualId) return;
    if (modoAcesso === "convidado-visualizar") return;
    if (salvandoEmProgresso) return;

    const dadosFicha = {
        nome: document.getElementById('nome').value,
        idade: document.getElementById('idade').value,
        altura: document.getElementById('altura').value,
        sexo: document.getElementById('sexo').value,
        etnia: document.getElementById('etnia').value,
        corPele: document.getElementById('cor-pele').value,
        nivel: document.getElementById('nivel').value,
        exp: document.getElementById('exp').value,
        forca: forca.value,
        destreza: destreza.value,
        forcaAcao: forcaAcao.value,
        destrezaAcao: destrezaAcao.value,
        constituicao: document.getElementById('constituicao').value,
        inteligencia: document.getElementById('inteligencia').value,
        percepcao: document.getElementById('percepcao').value,
        vontade: document.getElementById('vontade').value,
        carisma: document.getElementById('carisma').value,
        esquiva: document.getElementById('esquiva').value,
        movimentacao: document.getElementById('movimentacao').value,
        diario: document.getElementById('diario').value,
        talentos: Array.from(document.querySelectorAll('#talentos input')).map(input => input.value),
        pesoPersonagem: pesoPersonagemInput ? pesoPersonagemInput.value : '',
        fotoPersonagem: "",
        fotoPersonagemNome: "",
        fotoPersonagemDesc: "",
        itensMochila: [],
        itensEquipamento: []
    };

    const imagensAtivas = {};

    const fotoContainer = document.getElementById('foto-personagem');
    const imagemRetrato = fotoContainer.querySelector('img');
    if (imagemRetrato) {
        const foto = imagemRetrato.getAttribute('src');
        imagensAtivas.personagem = foto;
        dadosFicha.fotoPersonagem = fotoContainer.innerHTML.replace(foto, "__IMAGEM_PERSONAGEM__");
        dadosFicha.fotoPersonagemNome = fotoContainer.getAttribute('data-nome-foto') || '';
        dadosFicha.fotoPersonagemDesc = fotoContainer.getAttribute('data-desc-foto') || '';
    } else {
        dadosFicha.fotoPersonagem = "";
    }

    const itensMochila = document.querySelectorAll('#inventario .item-adicionado');
    for (const el of itensMochila) {
        const dados = JSON.parse(el.dataset.itemData);
        const imagemId = `mochila_${el.id}`;
        if (dados.img) imagensAtivas[imagemId] = dados.img;
        dadosFicha.itensMochila.push({
            dados: { nome: dados.nome, qtd: dados.qtd, peso: dados.peso, desc: dados.desc || "", img: "" },
            imagemId, posicao: el.id
        });
    }

    const todosSlots = Array.from(document.querySelectorAll('.slot-vazio'));
    const itensEquipamento = document.querySelectorAll('.slot-vazio.item-adicionado');
    for (const el of itensEquipamento) {
        if (el.id === 'foto-personagem') continue;
        const dados = JSON.parse(el.dataset.itemData);
        const indice = todosSlots.indexOf(el);
        const imagemId = `equipamento_${indice}`;
        if (dados.img) imagensAtivas[imagemId] = dados.img;
        dadosFicha.itensEquipamento.push({
            dados: { nome: dados.nome, qtd: dados.qtd, peso: dados.peso, desc: dados.desc || "", img: "" },
            imagemId, posicao: el.getAttribute('data-original')
        });
    }

    if (modoAcesso === "mestre") {
        dadosFicha.tipo = fichaAtualTipo;
        dadosFicha.proprietarioUid = fichaAtualProprietarioUid;
        dadosFicha.criadoPor = fichaAtualCriadoPor || usuarioAtual.uid;
    }

    const assinatura = JSON.stringify(dadosFicha);
    if (assinatura === ultimoEstadoSalvo) return;

    salvandoEmProgresso = true;
    if (!opcoes.silencioso) {
        const btn = document.getElementById('btn-salvar-ficha');
        if (btn) { btn.disabled = true; btn.innerText = "SALVANDO..."; }
        tocarSom(audioSalvarManual);
    } else {
        mostrarIndicador('Salvando...', 'bg-yellow-700');
    }

    try {
        await setDoc(doc(db, "fichas", fichaAtualId), dadosFicha, { merge: true });

        for (const [idImagem, imagem] of Object.entries(imagensAtivas)) {
            await salvarImagemSeparada(idImagem, imagem);
        }

        const imagensAntigas = await getDocs(collection(db, "fichas", fichaAtualId, "imagens"));
        for (const documento of imagensAntigas.docs) {
            if (!imagensAtivas[documento.id]) await deleteDoc(documento.ref);
        }

        ultimoEstadoSalvo = assinatura;
        if (!opcoes.silencioso && !opcoes.semAlerta) alert("Ficha salva com sucesso!");
        if (opcoes.silencioso) {
            mostrarIndicador('Salvo ✓', 'bg-green-700');
            tocarSom(audioSalvarAuto);
        }
    } catch (e) {
        console.error("Falha ao salvar ficha:", e);
        if (opcoes.silencioso) mostrarIndicador('Erro ao salvar', 'bg-red-800');
        else alert(`Erro ao salvar ficha (${e.code || "desconhecido"}): ${e.message}`);
    } finally {
        salvandoEmProgresso = false;
        if (!opcoes.silencioso) {
            const btn = document.getElementById('btn-salvar-ficha');
            if (btn) { btn.disabled = false; btn.innerText = "SALVAR FICHA"; }
        }
    }
}

document.getElementById('btn-salvar-ficha').onclick = () => salvarFicha({ silencioso: false });

async function carregarFicha() {
    if (!usuarioAtual || !fichaAtualId) return;
    let docSnap = await getDoc(doc(db, "fichas", fichaAtualId));
    const mestreLogado = (usuarioAtual.email || '').trim().toLowerCase() === emailMestre.toLowerCase();

    if (!docSnap.exists() && fichaAtualId === usuarioAtual.uid) {
        const vinculadas = await getDocs(query(collection(db, 'fichas'), where('proprietarioUid', '==', usuarioAtual.uid), limit(1)));
        if (!vinculadas.empty) { docSnap = vinculadas.docs[0]; fichaAtualId = docSnap.id; }
    }

    if (!docSnap.exists()) {
        if (fichaAtualId !== usuarioAtual.uid) {
            alert("Esta ficha não foi encontrada ou você não tem acesso a ela.");
            window.location.href = window.location.pathname;
        }
        return;
    }

    const d = docSnap.data();
    if (!mestreLogado && fichaAtualId !== usuarioAtual.uid && d.proprietarioUid !== usuarioAtual.uid && modoAcesso !== "convidado-editar" && modoAcesso !== "convidado-visualizar") {
        alert('Você não tem permissão para abrir esta ficha.');
        window.location.href = window.location.pathname;
        return;
    }

    fichaAtualTipo = d.tipo || "jogador";
    fichaAtualProprietarioUid = d.proprietarioUid || (fichaAtualTipo === "jogador" ? fichaAtualId : null);
    fichaAtualCriadoPor = d.criadoPor || fichaAtualProprietarioUid || usuarioAtual.uid;

    const imagensSeparadas = await carregarImagensSeparadas();

    document.getElementById('nome').value = d.nome || '';
    document.getElementById('idade').value = d.idade || '';
    document.getElementById('altura').value = d.altura || '';
    document.getElementById('sexo').value = d.sexo || '';
    document.getElementById('etnia').value = d.etnia || '';
    document.getElementById('cor-pele').value = d.corPele || '';
    document.getElementById('nivel').value = d.nivel || '';
    document.getElementById('exp').value = d.exp || '';
    forca.value = d.forca || '';
    destreza.value = d.destreza || '';
    calcular();
    document.getElementById('constituicao').value = d.constituicao || '';
    document.getElementById('inteligencia').value = d.inteligencia || '';
    document.getElementById('percepcao').value = d.percepcao || '';
    document.getElementById('vontade').value = d.vontade || '';
    document.getElementById('carisma').value = d.carisma || '';
    document.getElementById('esquiva').value = d.esquiva || '';
    document.getElementById('movimentacao').value = d.movimentacao || 6;
    document.getElementById('diario').value = d.diario || '';
    if (pesoPersonagemInput) pesoPersonagemInput.value = d.pesoPersonagem || '';

    const camposTalentos = document.querySelectorAll('#talentos input');
    camposTalentos.forEach((input, indice) => { input.value = (d.talentos || [])[indice] || ''; });

    if (d.fotoPersonagem && d.fotoPersonagem.includes('img')) {
        let fotoHTML = d.fotoPersonagem;
        if (imagensSeparadas.personagem) {
            fotoHTML = fotoHTML.replace("__IMAGEM_PERSONAGEM__", imagensSeparadas.personagem);
        }
        document.getElementById('foto-personagem').innerHTML = fotoHTML;
        document.getElementById('foto-personagem').setAttribute('data-nome-foto', d.fotoPersonagemNome || '');
        document.getElementById('foto-personagem').setAttribute('data-desc-foto', d.fotoPersonagemDesc || '');
    }

    document.querySelectorAll('.item-adicionado').forEach(el => {
        el.classList.remove('item-adicionado');
        el.removeAttribute('data-itemData');
        el.removeAttribute('data-peso');
        el.removeAttribute('data-qtd');
    });

    if (d.itensMochila) {
        d.itensMochila.forEach(item => {
            const el = document.getElementById(item.posicao);
            if (el) {
                const dados = { ...item.dados };
                if (item.imagemId && imagensSeparadas[item.imagemId]) dados.img = imagensSeparadas[item.imagemId];
                if (!dados.img && item.dados.img) dados.img = item.dados.img;
                renderizarItem(el, dados);
            }
        });
    }

    if (d.itensEquipamento) {
        d.itensEquipamento.forEach(item => {
            const el = Array.from(document.querySelectorAll('.slot-vazio')).find(e => e.getAttribute('data-original') === item.posicao);
            if (el) {
                const dados = { ...item.dados };
                if (item.imagemId && imagensSeparadas[item.imagemId]) dados.img = imagensSeparadas[item.imagemId];
                if (!dados.img && item.dados.img) dados.img = item.dados.img;
                renderizarItem(el, dados);
            }
        });
    }

    calcularPesoGeral();
    ultimoEstadoSalvo = JSON.stringify({
        nome: d.nome || '', idade: d.idade || '', altura: d.altura || '',
        sexo: d.sexo || '', etnia: d.etnia || '', corPele: d.corPele || '',
        nivel: d.nivel || '', exp: d.exp || ''
    });
}

async function registrarContaJogador(user) {
    if (!user || !user.uid || !user.email) return;
    const email = (user.email || '').trim().toLowerCase();
    if (email === emailMestre.toLowerCase()) return;
    const nome = (user.displayName || (email ? email.split('@')[0] : 'Jogador')).trim();
    await setDoc(doc(db, 'usuarios', user.uid), {
        uid: user.uid, email, nome, atualizadoEm: new Date().toISOString()
    }, { merge: true });
}

async function copiarTexto(valor) {
    try { await navigator.clipboard.writeText(String(valor)); alert('UID copiado!'); }
    catch (erro) { window.prompt('Copie o UID abaixo:', String(valor)); }
}

async function carregarContasJogadores() {
    const lista = document.getElementById('lista-contas-jogadores');
    const contador = document.getElementById('contador-contas');
    if (!lista) return;
    lista.innerHTML = '<p class="text-[#111] text-lg">Buscando contas registradas...</p>';
    try {
        const snapshot = await getDocs(collection(db, 'usuarios'));
        const contas = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(conta => (conta.email || '').toLowerCase() !== emailMestre.toLowerCase())
            .sort((a, b) => (a.nome || a.email || '').localeCompare(b.nome || b.email || '', 'pt-BR'));
        if (contador) contador.textContent = `Contas: ${contas.length}`;
        lista.innerHTML = '';
        if (!contas.length) {
            lista.innerHTML = '<p class="text-[#111] text-lg font-bold">Nenhuma conta registrada ainda.</p>';
            return;
        }
        contas.forEach(conta => {
            const linha = document.createElement('div');
            linha.className = 'flex flex-col md:flex-row md:items-center justify-between gap-3 rounded border border-[#7a4e32] bg-white/70 p-3';
            const dados = document.createElement('div');
            dados.className = 'min-w-0';
            const nome = document.createElement('p'); nome.className = 'font-bold text-[#211b17] text-lg'; nome.textContent = conta.nome || 'Jogador';
            const email = document.createElement('p'); email.className = 'text-sm text-[#3a2e27] break-all'; email.textContent = conta.email || 'E-mail não informado';
            const uid = document.createElement('p'); uid.className = 'uid-conta break-all mt-2'; uid.textContent = `UID: ${conta.uid || conta.id}`;
            dados.append(nome, email, uid);
            
            const acoes = document.createElement('div');
            acoes.className = 'flex gap-2';
            acoes.append(criarBotaoPainel('COPIAR UID', 'bg-indigo-800', () => { tocarSom(audioClique); copiarTexto(conta.uid || conta.id); }));
            acoes.append(criarBotaoPainel('BANIR', 'bg-red-900', () => { tocarSom(audioClique); banirConta(conta.uid || conta.id); }));

            linha.append(dados, acoes);
            lista.appendChild(linha);
        });
    } catch (erro) {
        console.error('Erro ao carregar contas de jogadores:', erro);
        lista.innerHTML = `<p class="text-red-800 font-bold text-lg">Não foi possível carregar as contas (${erro.code || 'erro'}): ${erro.message}.</p>`;
        if (contador) contador.textContent = 'Contas: erro';
    }
}

// FUNÇÃO PARA BANIR CONTA
async function banirConta(uid) {
    if (!confirm("Tem certeza que deseja BANIR esta conta? O jogador perderá o acesso e o perfil será deletado do banco de dados. (Nota: a conta de login ainda existirá no Firebase Authentication por segurança).")) return;
    try {
        await deleteDoc(doc(db, 'usuarios', uid));
        alert('Conta banida e removida do banco de dados.');
        carregarContasJogadores(); // Recarrega a lista
    } catch (e) {
        console.error("Erro ao banir conta:", e);
        alert(`Erro ao banir: ${e.message}`);
    }
}

const btnAtualizarContas = document.getElementById('btn-atualizar-contas');
if (btnAtualizarContas) btnAtualizarContas.addEventListener('click', () => { tocarSom(audioClique); carregarContasJogadores(); });

function abrirFichaEmNovaAba(idFicha) {
    tocarSom(audioClique);
    const url = new URL(window.location.href);
    url.searchParams.set('ficha', idFicha);
    window.open(url.toString(), '_blank', 'noopener');
}

function criarBotaoPainel(texto, classe, acao) {
    const botao = document.createElement('button');
    botao.type = 'button'; botao.textContent = texto;
    botao.className = `px-4 py-3 rounded text-sm md:text-base font-bold text-white tracking-wide shadow-md hover:brightness-110 active:scale-[.98] transition ${classe}`;
    botao.addEventListener('click', acao);
    return botao;
}

async function obterImagemRetrato(idFicha, ficha) {
    try {
        const imagem = await getDoc(doc(db, 'fichas', idFicha, 'imagens', 'personagem'));
        if (imagem.exists() && imagem.data().imagem) return imagem.data().imagem;
    } catch (e) { console.warn('Não foi possível carregar o retrato:', idFicha, e); }
    const html = ficha.fotoPersonagem || '';
    const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    return match ? match[1] : '';
}

async function criarCardFicha(idFicha, ficha, modoMestre = false) {
    const card = document.createElement('article');
    card.className = 'bg-[#211b17] text-[#e6d5b8] rounded-lg overflow-hidden border-2 border-[#7a4e32] shadow-xl flex flex-col';
    const retrato = document.createElement('div');
    retrato.className = 'h-56 bg-black/50 flex items-center justify-center overflow-hidden';
    retrato.innerHTML = '<div class="text-center text-white/40"><div class="text-5xl">☣</div><div class="text-xs mt-2">SEM RETRATO</div></div>';
    obterImagemRetrato(idFicha, ficha).then(src => {
        if (src) { const img = document.createElement('img'); img.src = src; img.alt = ficha.nome || 'Personagem'; img.className = 'w-full h-full object-cover object-top'; retrato.replaceChildren(img); }
    });
    const conteudo = document.createElement('div');
    conteudo.className = 'p-4 flex flex-col gap-2 flex-1';
    
    if (modoMestre) {
        const nome = document.createElement('h3'); 
        nome.className = 'fonte-titulo text-3xl text-[#fff]'; 
        nome.textContent = ficha.nome || 'Personagem sem nome';
        
        const nivelExp = document.createElement('p'); 
        nivelExp.className = 'text-base font-bold text-[#d2b48c] texto-card-mestre'; 
        nivelExp.textContent = `NÍVEL: ${ficha.nivel || '1'} | EXP: ${ficha.exp || '0'}`;
        
        const jogador = document.createElement('p'); 
        jogador.className = 'text-lg font-bold text-[#fff] mt-2 texto-card-mestre';
        const nomeDono = ficha.proprietarioNome || 'NÃO VINCULADO';
        jogador.textContent = `Jogador (Dono): ${nomeDono}`;
        
        const emailDono = document.createElement('p'); 
        emailDono.className = 'text-base font-bold text-[#fff] texto-card-mestre';
        emailDono.textContent = `Email do Dono: ${ficha.proprietarioEmail || (ficha.tipo === 'pdm' ? 'N/A' : 'Nenhum')}`;
        
        const uid = document.createElement('p'); 
        uid.className = 'text-base font-bold text-[#fff] break-all texto-card-mestre';
        uid.textContent = `UID do Dono: ${ficha.proprietarioUid || 'N/A'}`;
        
        conteudo.append(nome, nivelExp, jogador, emailDono, uid);
        
        try {
            const acessosSnap = await getDocs(collection(db, 'fichas', idFicha, 'acessos'));
            if (!acessosSnap.empty) {
                const tituloAcesso = document.createElement('p');
                tituloAcesso.className = 'text-sm font-bold text-[#f3dfc1] mt-4 mb-2 border-b border-[#7a4e32] pb-1 texto-card-mestre';
                tituloAcesso.textContent = 'CONVIDADOS COM ACESSO:';
                conteudo.append(tituloAcesso);
                
                for (const a of acessosSnap.docs) {
                    const d = a.data();
                    const linha = document.createElement('div');
                    linha.className = 'flex flex-col md:flex-row md:items-center justify-between gap-2 bg-black/30 p-2 rounded mb-1';
                    
                    const txtConvidado = document.createElement('span');
                    txtConvidado.className = 'text-sm font-bold text-[#e6d5b8] break-all texto-card-mestre';
                    txtConvidado.textContent = `UID: ${a.id} | Permissão: ${d.permissao.toUpperCase()}`;
                    
                    const acoesConv = document.createElement('div');
                    acoesConv.className = 'flex gap-1 mt-2 md:mt-0';
                    
                    const btnMudar = document.createElement('button');
                    btnMudar.className = 'bg-blue-800 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs font-bold transition w-full md:w-auto';
                    btnMudar.textContent = d.permissao === 'editar' ? 'MUDAR P/ VER' : 'MUDAR P/ EDITAR';
                    btnMudar.onclick = () => { tocarSom(audioClique); mudarPermissao(idFicha, a.id, d.permissao); };

                    const btnRevogar = document.createElement('button');
                    btnRevogar.className = 'bg-red-800 hover:bg-red-700 text-white px-2 py-1 rounded text-xs font-bold transition w-full md:w-auto';
                    btnRevogar.textContent = 'REVOGAR';
                    btnRevogar.onclick = () => { tocarSom(audioClique); revogarAcesso(idFicha, a.id); };
                    
                    acoesConv.append(btnMudar, btnRevogar);
                    linha.append(txtConvidado, acoesConv);
                    conteudo.append(linha);
                }
            }
        } catch (e) {}
    } else {
        const nome = document.createElement('h3'); nome.className = 'fonte-titulo text-2xl'; nome.textContent = ficha.nome || 'Personagem sem nome';
        const tipo = ficha.tipo === 'pdm' ? 'PDM' : 'PERSONAGEM';
        const detalhes = document.createElement('p'); detalhes.className = 'text-sm text-[#d2b48c]';
        detalhes.textContent = `${tipo} • Nível ${ficha.nivel || '1'} • EXP ${ficha.exp || '0'}`;
        conteudo.append(nome, detalhes);
    }

    const acoes = document.createElement('div'); acoes.className = 'mt-auto pt-3 flex flex-wrap gap-2';
    acoes.append(criarBotaoPainel(modoMestre ? 'ABRIR / EDITAR' : 'ABRIR FICHA', 'bg-[#a81c1c] hover:brightness-125', () => abrirFichaEmNovaAba(idFicha)));

    if (modoMestre) {
        acoes.append(criarBotaoPainel('CONVIDAR POR LINK', 'bg-purple-800', () => { tocarSom(audioClique); gerarLinkConvite(idFicha); }));
        if (ficha.proprietarioUid) acoes.append(criarBotaoPainel('COPIAR UID', 'bg-indigo-800', () => { tocarSom(audioClique); copiarTexto(ficha.proprietarioUid); }));
        acoes.append(criarBotaoPainel('DUPLICAR', 'bg-blue-800', () => { tocarSom(audioClique); duplicarFicha(idFicha, ficha); }));
        acoes.append(criarBotaoPainel('VINCULAR JOGADOR', 'bg-green-800', () => { tocarSom(audioClique); vincularJogador(idFicha, ficha); }));
        if (ficha.proprietarioUid) acoes.append(criarBotaoPainel('DESVINCULAR', 'bg-gray-700', () => { tocarSom(audioClique); desvincularJogador(idFicha, ficha); }));
        acoes.append(criarBotaoPainel('EXCLUIR', 'bg-red-900', () => { tocarSom(audioClique); excluirFicha(idFicha, ficha); }));
    }

    conteudo.append(acoes);
    card.append(retrato, conteudo);
    return card;
}

async function carregarDashboardJogador() {
    const lista = document.getElementById('cards-jogador');
    lista.innerHTML = '<p class="text-[#111] text-lg">Carregando seus personagens...</p>';
    try {
        const encontrados = new Map();
        const propria = await getDoc(doc(db, 'fichas', usuarioAtual.uid));
        if (propria.exists()) encontrados.set(propria.id, propria.data());
        const vinculadas = await getDocs(query(collection(db, 'fichas'), where('proprietarioUid', '==', usuarioAtual.uid)));
        vinculadas.forEach(d => encontrados.set(d.id, d.data()));
        lista.innerHTML = '';
        if (!encontrados.size) { 
            lista.innerHTML = '<p class="text-[#111] text-lg font-bold col-span-full text-center py-10">Nenhum personagem encontrado nesta conta.<br><span class="text-sm font-normal">Sua conta foi criada com sucesso! Peça ao Mestre para vincular um personagem ao seu e-mail ou UID.</span></p>'; 
            return; 
        }
        for (const [id, ficha] of [...encontrados.entries()].sort((a,b) => (a[1].nome || '').localeCompare(b[1].nome || '', 'pt-BR'))) {
            lista.appendChild(await criarCardFicha(id, ficha));
        }
    } catch (e) {
        console.error('Erro ao carregar painel do jogador:', e);
        lista.innerHTML = `<p class="text-red-800 col-span-full font-bold text-lg">Não foi possível listar seus personagens (${e.code || 'erro'}): ${e.message}</p>`;
    }
}

async function carregarDashboardMestre() {
    const lista = document.getElementById('cards-mestre');
    lista.innerHTML = '<p class="text-[#111] text-lg">Carregando todas as fichas...</p>';
    try {
        const snapshot = await getDocs(collection(db, 'fichas'));
        await carregarContasJogadores();
        lista.innerHTML = '';
        const docs = [...snapshot.docs].sort((a,b) => (a.data().nome || '').localeCompare(b.data().nome || '', 'pt-BR'));
        const pdms = docs.filter(d => d.data().tipo === 'pdm').length;
        document.getElementById('contador-fichas').textContent = `Fichas: ${docs.length}`;
        document.getElementById('contador-pdms').textContent = `PDMs: ${pdms}`;
        if (!docs.length) { lista.innerHTML = '<p class="text-[#111] col-span-full text-center py-10 font-bold text-lg">Nenhuma ficha cadastrada.</p>'; return; }
        for (const d of docs) {
            lista.appendChild(await criarCardFicha(d.id, d.data(), true));
        }
        await carregarSolicitacoesPendentes();
    } catch (e) {
        console.error('Erro ao carregar painel do mestre:', e);
        lista.innerHTML = `<p class="text-red-800 col-span-full font-bold text-lg">Erro ao carregar fichas (${e.code || 'erro'}): ${e.message}</p>`;
    }
}

async function atualizarPainelMestre() { return carregarDashboardMestre(); }

function voltarAoPainel() {
    tocarSom(audioSairFicha);
    if (autosaveHabilitado) {
        salvarFicha({ silencioso: true, semAlerta: true }).finally(() => {
            window.close();
            setTimeout(() => {
                const url = new URL(window.location.href); url.searchParams.delete('ficha'); url.searchParams.delete('convite');
                window.location.href = url.toString();
            }, 100);
        });
        return;
    }
    window.close();
    setTimeout(() => {
        const url = new URL(window.location.href); url.searchParams.delete('ficha'); url.searchParams.delete('convite');
        window.location.href = url.toString();
    }, 100);
}

document.getElementById('btn-voltar-painel').onclick = voltarAoPainel;
document.getElementById('btn-sair-jogador').onclick = () => { tocarSom(audioSairPainel); signOut(auth).then(() => window.location.reload()); };
document.getElementById('btn-sair-mestre').onclick = () => { tocarSom(audioSairPainel); signOut(auth).then(() => window.location.reload()); };
document.getElementById('btn-criar-pdm-dashboard').onclick = () => { tocarSom(audioClique); criarPDM(); };

function gerarLinkConvite(idFicha) {
    const url = new URL(window.location.href);
    url.searchParams.set('ficha', idFicha);
    url.searchParams.set('convite', '1');
    const link = url.toString();
    if (navigator.clipboard) {
        navigator.clipboard.writeText(link).then(() => alert(`Link de convite copiado:\n\n${link}`)).catch(() => window.prompt('Copie o link:', link));
    } else {
        window.prompt('Copie o link:', link);
    }
}

async function carregarSolicitacoesPendentes() {
    const container = document.getElementById('solicitacoes-mestre');
    if (!container) return;
    
    container.innerHTML = '<p class="text-[#111] text-lg">Buscando solicitações...</p>';
    
    try {
        const fichasSnap = await getDocs(collection(db, 'fichas'));
        const todas = [];
        
        for (const fichaDoc of fichasSnap.docs) {
            try {
                const solSnap = await getDocs(collection(db, 'fichas', fichaDoc.id, 'solicitacoes'));
                solSnap.forEach(s => {
                    const data = s.data();
                    if (data.status === 'pendente') {
                        todas.push({ 
                            fichaId: fichaDoc.id, 
                            fichaNome: fichaDoc.data().nome || 'Sem nome', 
                            uidConvidado: s.id, 
                            ...data 
                        });
                    }
                });
            } catch (errFicha) {
                console.warn("Erro ao ler solicitações da ficha " + fichaDoc.id, errFicha);
            }
        }
        
        container.innerHTML = '';
        
        if (todas.length === 0) { 
            container.innerHTML = '<p class="text-[#111] text-lg font-bold">Nenhuma solicitação pendente no momento.</p>'; 
            return; 
        }
        
        todas.forEach(sol => {
            const linha = document.createElement('div');
            linha.className = 'flex flex-col md:flex-row md:items-center justify-between gap-3 rounded border-2 border-[#7a4e32] bg-white/90 p-4';
            
            const dados = document.createElement('div');
            dados.className = 'min-w-0';
            
            const nome = document.createElement('p'); 
            nome.className = 'font-bold text-[#211b17] text-lg'; 
            nome.textContent = `Ficha: ${sol.fichaNome}`;
            
            const uid = document.createElement('p'); 
            uid.className = 'text-[#211b17] font-bold mt-1 break-all text-base'; 
            uid.textContent = `UID do Convidado: ${sol.uidConvidado}`;
            
            dados.append(nome, uid);
            
            const acoes = document.createElement('div'); 
            acoes.className = 'flex flex-wrap gap-2 mt-2 md:mt-0';
            
            acoes.append(criarBotaoPainel('APROVAR (EDITAR)', 'bg-green-800 text-base', () => { tocarSom(audioClique); aprovarSolicitacao(sol.fichaId, sol.uidConvidado, 'editar'); }));
            acoes.append(criarBotaoPainel('APROVAR (VER)', 'bg-blue-800 text-base', () => { tocarSom(audioClique); aprovarSolicitacao(sol.fichaId, sol.uidConvidado, 'visualizar'); }));
            acoes.append(criarBotaoPainel('RECUSAR', 'bg-red-900 text-base', () => { tocarSom(audioSairPainel); recusarSolicitacao(sol.fichaId, sol.uidConvidado); }));
            
            linha.append(dados, acoes);
            container.appendChild(linha);
        });
        
    } catch (e) {
        console.error('Erro ao carregar solicitações:', e);
        container.innerHTML = `<p class="text-red-800 font-bold text-lg">Erro ao buscar solicitações (${e.code || 'erro'}): ${e.message}</p>`;
    }
}

async function aprovarSolicitacao(fichaId, uidConvidado, permissao) {
    try {
        await setDoc(doc(db, 'fichas', fichaId, 'acessos', uidConvidado), {
            permissao: permissao,
            aprovadoEm: new Date().toISOString(),
            aprovadoPor: usuarioAtual.uid
        });
        await setDoc(doc(db, 'fichas', fichaId, 'solicitacoes', uidConvidado), {
            status: 'aprovado',
            permissao: permissao,
            respondidoEm: new Date().toISOString()
        }, { merge: true });
        alert(`Acesso aprovado como ${permissao}.`);
        carregarSolicitacoesPendentes();
        carregarDashboardMestre();
    } catch (e) {
        console.error("Erro ao aprovar:", e);
        alert(`Erro ao aprovar (${e.code || 'erro'}): ${e.message}`);
    }
}

async function mudarPermissao(fichaId, uidConvidado, permissaoAtual) {
    const novaPermissao = permissaoAtual === 'editar' ? 'visualizar' : 'editar';
    try {
        await setDoc(doc(db, 'fichas', fichaId, 'acessos', uidConvidado), {
            permissao: novaPermissao,
            atualizadoEm: new Date().toISOString()
        }, { merge: true });
        alert(`Permissão alterada para ${novaPermissao.toUpperCase()}.`);
        carregarDashboardMestre();
    } catch (e) {
        console.error("Erro ao mudar permissão:", e);
        alert(`Erro ao mudar permissão: ${e.message}`);
    }
}

async function revogarAcesso(fichaId, uidConvidado) {
    if (!confirm("Tem certeza que deseja revogar o acesso deste convidado? A ficha fechará para ele.")) return;
    try {
        await deleteDoc(doc(db, 'fichas', fichaId, 'acessos', uidConvidado));
        await setDoc(doc(db, 'fichas', fichaId, 'solicitacoes', uidConvidado), {
            status: 'revogado',
            respondidoEm: new Date().toISOString()
        }, { merge: true });
        alert('Acesso revogado com sucesso.');
        carregarDashboardMestre();
    } catch (e) {
        console.error("Erro ao revogar:", e);
        alert(`Erro ao revogar (${e.code || 'erro'}): ${e.message}`);
    }
}

async function recusarSolicitacao(fichaId, uidConvidado) {
    try {
        await setDoc(doc(db, 'fichas', fichaId, 'solicitacoes', uidConvidado), {
            status: 'recusado',
            respondidoEm: new Date().toISOString()
        }, { merge: true });
        alert('Solicitação recusada.');
        carregarSolicitacoesPendentes();
    } catch (e) {
        console.error("Erro ao recusar:", e);
        alert(`Erro ao recusar (${e.code || 'erro'}): ${e.message}`);
    }
}

const btnAtualizarSolicitacoes = document.getElementById('btn-atualizar-solicitacoes');
if (btnAtualizarSolicitacoes) btnAtualizarSolicitacoes.addEventListener('click', () => { tocarSom(audioClique); carregarSolicitacoesPendentes(); });

async function criarPDM() {
    if (!usuarioAtual || (usuarioAtual.email || '').trim().toLowerCase() !== emailMestre.toLowerCase()) return;
    const nome = prompt('Nome do novo PDM:', 'Novo PDM');
    if (nome === null) return;
    try {
        const novaFicha = doc(collection(db, 'fichas'));
        await setDoc(novaFicha, { tipo: 'pdm', proprietarioUid: null, proprietarioNome: '', criadoPor: usuarioAtual.uid, nome: nome.trim() || 'Novo PDM', idade: '', altura: '', sexo: '', etnia: '', corPele: '', nivel: '1', exp: '', forca: '', destreza: '', forcaAcao: '', destrezaAcao: '', constituicao: '', inteligencia: '', percepcao: '', vontade: '', carisma: '', esquiva: '', movimentacao: '6', diario: '', talentos: [], pesoPersonagem: '', fotoPersonagem: '', itensMochila: [], itensEquipamento: [] });
        await atualizarPainelMestre(); alert('PDM criado!');
    } catch (e) { console.error(e); alert(`Não foi possível criar o PDM: ${e.message}`); }
}

async function excluirFicha(idFicha, ficha) {
    if (!confirm(`Tem certeza de que deseja excluir ${ficha.nome || 'esta ficha'}? Esta ação não pode ser desfeita.`)) return;
    try {
        const imagens = await getDocs(collection(db, 'fichas', idFicha, 'imagens'));
        const acessos = await getDocs(collection(db, 'fichas', idFicha, 'acessos'));
        const solicitacoes = await getDocs(collection(db, 'fichas', idFicha, 'solicitacoes'));
        const lote = writeBatch(db);
        imagens.forEach(item => lote.delete(item.ref));
        acessos.forEach(item => lote.delete(item.ref));
        solicitacoes.forEach(item => lote.delete(item.ref));
        lote.delete(doc(db, 'fichas', idFicha));
        await lote.commit();
        await atualizarPainelMestre();
        alert('Ficha, imagens, acessos e solicitações excluídos.');
    } catch (e) { console.error(e); alert(`Erro ao excluir ficha: ${e.message}`); }
}

async function duplicarFicha(idFicha, ficha) {
    const novoNome = prompt('Nome da cópia:', `${ficha.nome || 'Personagem'} (Cópia)`); if (novoNome === null) return;
    try {
        const imagensOrigem = await getDocs(collection(db, 'fichas', idFicha, 'imagens'));
        const novaRef = doc(collection(db, 'fichas'));
        const copia = { ...ficha, nome: novoNome.trim() || `${ficha.nome || 'Personagem'} (Cópia)`, tipo: 'pdm', proprietarioUid: null, proprietarioNome: '', proprietarioEmail: '', criadoPor: usuarioAtual.uid };
        delete copia.fotoPersonagem;
        await setDoc(novaRef, copia);
        const lote = writeBatch(db);
        imagensOrigem.forEach(item => lote.set(doc(db, 'fichas', novaRef.id, 'imagens', item.id), item.data()));
        if (!imagensOrigem.empty) await lote.commit();
        await atualizarPainelMestre(); alert('Cópia criada como PDM independente.');
    } catch (e) { console.error(e); alert(`Erro ao duplicar ficha: ${e.message}`); }
}

async function vincularJogador(idFicha, ficha) {
    const uid = prompt('UID da conta Firebase do jogador:', ficha.proprietarioUid || ''); if (uid === null) return;
    const uidLimpo = uid.trim();
    if (!uidLimpo || uidLimpo.length < 10) return alert('Informe o UID completo da conta Firebase.');
    const nomeJogador = prompt('Nome do jogador (opcional):', ficha.proprietarioNome || ''); if (nomeJogador === null) return;
    try {
        await setDoc(doc(db, 'fichas', idFicha), { proprietarioUid: uidLimpo, proprietarioNome: nomeJogador.trim(), tipo: 'jogador' }, { merge: true });
        await atualizarPainelMestre(); alert('Jogador vinculado.');
    } catch (e) { console.error(e); alert(`Erro ao vincular jogador: ${e.message}`); }
}

async function desvincularJogador(idFicha, ficha) {
    if (!ficha.proprietarioUid) return alert('Esta ficha não possui jogador vinculado.');
    if (!confirm(`Desvincular o jogador desta ficha (${ficha.nome || 'Sem nome'})?`)) return;
    try {
        await setDoc(doc(db, 'fichas', idFicha), { proprietarioUid: null, proprietarioNome: '', proprietarioEmail: '', tipo: 'pdm' }, { merge: true });
        await atualizarPainelMestre(); alert('Jogador desvinculado. A ficha agora é um PDM.');
    } catch (e) { console.error(e); alert(`Erro ao desvincular: ${e.message}`); }
}
