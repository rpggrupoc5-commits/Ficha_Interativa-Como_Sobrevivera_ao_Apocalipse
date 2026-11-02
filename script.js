import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    collection, 
    getDocs, 
    query, 
    where, 
    addDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// 1. CONFIGURAÇÃO DO FIREBASE
// (Substitua pelos dados do seu projeto)
// ==========================================
const firebaseConfig = {
    apiKey: "SUA_API_KEY_AQUI",
    authDomain: "SEU_PROJECT_ID.firebaseapp.com",
    projectId: "SEU_PROJECT_ID",
    storageBucket: "SEU_PROJECT_ID.appspot.com",
    messagingSenderId: "SEU_SENDER_ID",
    appId: "SEU_APP_ID"
};

const EMAIL_MESTRE = "rpggrupoc5@gmail.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Variables Globais de Estado
let usuarioAtual = null;
let fichaIdAtual = null;
let modoMestre = false;
let dadosFichaAtual = {};

// Lista de Talentos Padrão
const TALENTOS_PADRAO = [
    "Atirador de Elite", "Primeiros Socorros", "Mecanico de Gambiarra", 
    "Furtividade Urbana", "Atletismo Avançado", "Resistência Física", 
    "Liderança Nato", "Sobrevivente Urbano", "Perícia com Lâminas", 
    "Mestre de Armadilhas", "Negociador Frio", "Rastreamento"
];

// ==========================================
// 2. INICIALIZAÇÃO DA INTERFACE & EVENTOS
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    configurarEventos();
    renderizarTalentos();
    renderizarInventario();
    verificarParametroURL();
});

function verificarParametroURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const idParam = urlParams.get('fichaId');
    if (idParam) {
        fichaIdAtual = idParam;
    }
}

function configurarEventos() {
    // Autenticação
    document.getElementById("btn-entrar")?.addEventListener("click", fazerLogin);
    document.getElementById("btn-cadastrar")?.addEventListener("click", criarConta);
    document.getElementById("btn-sair")?.addEventListener("click", fazerLogout);

    // Salvar Ficha
    document.getElementById("btn-salvar-ficha")?.addEventListener("click", salvarFicha);

    // Painel do Mestre
    document.getElementById("btn-painel-mestre")?.addEventListener("click", abrirPainelMestre);
    document.getElementById("btn-fechar-mestre")?.addEventListener("click", fecharPainelMestre);
    document.getElementById("btn-criar-pdm")?.addEventListener("click", criarPDM);

    // Cálculos Automáticos de Atributos
    document.getElementById("forca")?.addEventListener("input", calcularAcoes);
    document.getElementById("destreza")?.addEventListener("input", calcularAcoes);

    // Uploads Globais de Fotos/Slots
    window.upload = fazerUploadSlot;
    window.uploadFoto = fazerUploadFotoPersonagem;
}

// Observador do Estado de Autenticação
onAuthStateChanged(auth, async (user) => {
    const telaLogin = document.getElementById("tela-login");
    const sitePrincipal = document.getElementById("site-principal");
    const btnMestre = document.getElementById("btn-painel-mestre");

    if (user) {
        usuarioAtual = user;
        modoMestre = (user.email === EMAIL_MESTRE);

        if (btnMestre) {
            btnMestre.classList.toggle("hidden", !modoMestre);
        }

        telaLogin?.classList.add("hidden");
        sitePrincipal?.classList.remove("hidden");

        // Se a URL não trouxer um fichaId específico, usa o UID do próprio jogador
        if (!fichaIdAtual) {
            fichaIdAtual = user.uid;
        }

        await carregarFicha(fichaIdAtual);
    } else {
        usuarioAtual = null;
        fichaIdAtual = null;
        telaLogin?.classList.remove("hidden");
        sitePrincipal?.classList.add("hidden");
    }
});

// ==========================================
// 3. FUNÇÕES DE AUTENTICAÇÃO
// ==========================================
async function fazerLogin() {
    const email = document.getElementById("login-email").value.trim();
    const senha = document.getElementById("login-senha").value.trim();
    const msgErro = document.getElementById("mensagem-erro");

    msgErro.classList.add("hidden");
    try {
        await signInWithEmailAndPassword(auth, email, senha);
    } catch (err) {
        msgErro.textContent = "Erro ao entrar: " + traduzirErroFirebase(err.code);
        msgErro.classList.remove("hidden");
    }
}

async function criarConta() {
    const email = document.getElementById("login-email").value.trim();
    const senha = document.getElementById("login-senha").value.trim();
    const msgErro = document.getElementById("mensagem-erro");

    msgErro.classList.add("hidden");
    try {
        const userCred = await createUserWithEmailAndPassword(auth, email, senha);
        // Cria documento de ficha padrão para o novo usuário
        await setDoc(doc(db, "fichas", userCred.user.uid), {
            nome: "Novo Sobrevivente",
            tipo: "jogador",
            proprietarioUid: userCred.user.uid,
            criadoPor: userCred.user.uid,
            dataCriacao: serverTimestamp(),
            atributos: { forca: 10, destreza: 10, constituicao: 10, inteligencia: 10, percepcao: 10, vontade: 10, carisma: 10 },
            esquiva: 0,
            movimentacao: 6,
            talentos: {},
            diario: ""
        });
    } catch (err) {
        msgErro.textContent = "Erro ao cadastrar: " + traduzirErroFirebase(err.code);
        msgErro.classList.remove("hidden");
    }
}

async function fazerLogout() {
    await signOut(auth);
    window.location.search = ""; // Limpa parâmetros da URL
}

function traduzirErroFirebase(code) {
    switch (code) {
        case "auth/invalid-email": return "E-mail inválido.";
        case "auth/user-not-found": return "Usuário não encontrado.";
        case "auth/wrong-password": return "Senha incorreta.";
        case "auth/email-already-in-use": return "Este e-mail já está em uso.";
        case "auth/weak-password": return "A senha deve ter pelo menos 6 caracteres.";
        default: return "Ocorreu um erro no acesso.";
    }
}

// ==========================================
// 4. CÁLCULOS E RENDERIZAÇÃO DA FICHA
// ==========================================
function calcularAcoes() {
    const forca = parseInt(document.getElementById("forca").value) || 0;
    const destreza = parseInt(document.getElementById("destreza").value) || 0;

    const forcaAcao = document.getElementById("forca-acao");
    const destrezaAcao = document.getElementById("destreza-acao");

    if (forcaAcao) forcaAcao.value = forca * 5;
    if (destrezaAcao) destrezaAcao.value = destreza * 5;
}

function renderizarTalentos() {
    const container = document.getElementById("talentos");
    if (!container) return;
    container.innerHTML = "";

    TALENTOS_PADRAO.forEach((talento, index) => {
        const id = `talento-${index}`;
        const div = document.createElement("div");
        div.className = "flex items-center gap-2 text-xs font-bold text-[#111]";
        div.innerHTML = `
            <input type="checkbox" id="${id}" class="chk-talento cursor-pointer">
            <label for="${id}" class="cursor-pointer">${talento}</label>
        `;
        container.appendChild(div);
    });
}

function renderizarInventario() {
    const container = document.getElementById("inventario");
    if (!container) return;
    container.innerHTML = "";

    for (let i = 1; i <= 16; i++) {
        const div = document.createElement("div");
        div.className = "slot-vazio text-xs font-bold text-center h-16";
        div.dataset.slotId = i;
        div.innerHTML = `Slot ${i}`;
        div.onclick = function() { fazerUploadSlot(this); };
        container.appendChild(div);
    }
}

// ==========================================
// 5. UPLOADS DE IMAGENS (BASE64 INTEGRADO)
// ==========================================
function fazerUploadFotoPersonagem(elemento) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            let img = elemento.querySelector("img");
            if (!img) {
                img = document.createElement("img");
                elemento.appendChild(img);
            }
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

function fazerUploadSlot(elemento) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            let img = elemento.querySelector("img");
            if (!img) {
                img = document.createElement("img");
                elemento.appendChild(img);
            }
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

// ==========================================
// 6. OPERAÇÕES DE FICHA (CARREGAR / SALVAR)
// ==========================================
async function carregarFicha(id) {
    try {
        const ref = doc(db, "fichas", id);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
            console.warn("Ficha não encontrada no Firestore.");
            return;
        }

        dadosFichaAtual = snap.data();

        // Dados Básicos
        document.getElementById("nome").value = dadosFichaAtual.nome || "";
        document.getElementById("idade").value = dadosFichaAtual.idade || "";
        document.getElementById("nivel").value = dadosFichaAtual.nivel || 1;
        document.getElementById("exp").value = dadosFichaAtual.exp || "0";

        // Atributos
        const atrb = dadosFichaAtual.atributos || {};
        document.getElementById("forca").value = atrb.forca || 0;
        document.getElementById("destreza").value = atrb.destreza || 0;
        document.getElementById("constituicao").value = atrb.constituicao || 0;
        document.getElementById("inteligencia").value = atrb.inteligencia || 0;
        document.getElementById("percepcao").value = atrb.percepcao || 0;
        document.getElementById("vontade").value = atrb.vontade || 0;
        document.getElementById("carisma").value = atrb.carisma || 0;
        
        document.getElementById("esquiva").value = dadosFichaAtual.esquiva || 0;
        document.getElementById("movimentacao").value = dadosFichaAtual.movimentacao || 6;
        document.getElementById("diario").value = dadosFichaAtual.diario || "";

        // Foto do Personagem
        if (dadosFichaAtual.fotoPersonagem) {
            const elFoto = document.getElementById("foto-personagem");
            let img = elFoto.querySelector("img");
            if (!img) {
                img = document.createElement("img");
                elFoto.appendChild(img);
            }
            img.src = dadosFichaAtual.fotoPersonagem;
        }

        // Talentos
        const talentosMarcados = dadosFichaAtual.talentos || {};
        document.querySelectorAll(".chk-talento").forEach((chk, idx) => {
            chk.checked = !!talentosMarcados[`talento_${idx}`];
        });

        calcularAcoes();
    } catch (err) {
        console.error("Erro ao carregar ficha:", err);
    }
}

async function salvarFicha() {
    if (!fichaIdAtual) return;

    const talentosMarcados = {};
    document.querySelectorAll(".chk-talento").forEach((chk, idx) => {
        talentosMarcados[`talento_${idx}`] = chk.checked;
    });

    const elFotoImg = document.getElementById("foto-personagem")?.querySelector("img");

    const dados = {
        nome: document.getElementById("nome").value,
        idade: document.getElementById("idade").value,
        nivel: document.getElementById("nivel").value,
        exp: document.getElementById("exp").value,
        atributos: {
            forca: parseInt(document.getElementById("forca").value) || 0,
            destreza: parseInt(document.getElementById("destreza").value) || 0,
            constituicao: parseInt(document.getElementById("constituicao").value) || 0,
            inteligencia: parseInt(document.getElementById("inteligencia").value) || 0,
            percepcao: parseInt(document.getElementById("percepcao").value) || 0,
            vontade: parseInt(document.getElementById("vontade").value) || 0,
            carisma: parseInt(document.getElementById("carisma").value) || 0,
        },
        esquiva: parseInt(document.getElementById("esquiva").value) || 0,
        movimentacao: parseInt(document.getElementById("movimentacao").value) || 6,
        diario: document.getElementById("diario").value,
        talentos: talentosMarcados,
        fotoPersonagem: elFotoImg ? elFotoImg.src : "",
        dataAtualizacao: serverTimestamp()
    };

    try {
        await updateDoc(doc(db, "fichas", fichaIdAtual), dados);
        alert("Ficha salva com sucesso!");
    } catch (err) {
        console.error("Erro ao salvar ficha:", err);
        alert("Erro ao salvar: " + err.message);
    }
}

// ==========================================
// 7. PAINEL DO MESTRE & GERENCIAMENTO
// ==========================================
async function abrirPainelMestre() {
    if (!modoMestre) return;
    const modal = document.getElementById("painel-mestre");
    modal?.classList.remove("hidden");
    await carregarListaFichas();
}

function fecharPainelMestre() {
    document.getElementById("painel-mestre")?.classList.add("hidden");
}

async function carregarListaFichas() {
    const listaContainer = document.getElementById("lista-jogadores");
    if (!listaContainer) return;

    listaContainer.innerHTML = "<p class='text-center mt-4 font-bold'>Buscando fichas...</p>";

    try {
        const querySnapshot = await getDocs(collection(db, "fichas"));
        listaContainer.innerHTML = "";

        if (querySnapshot.empty) {
            listaContainer.innerHTML = "<p class='text-center mt-4'>Nenhuma ficha registrada.</p>";
            return;
        }

        querySnapshot.forEach((documentoSnap) => {
            const ficha = documentoSnap.data();
            const id = documentoSnap.id;
            const tipo = ficha.tipo || "jogador";

            const divCard = document.createElement("div");
            divCard.className = "flex flex-wrap justify-between items-center p-3 bg-white/50 mb-2 rounded border border-black/20 gap-2";
            divCard.innerHTML = `
                <div>
                    <span class="font-bold text-lg text-[#111]">${ficha.nome || "Sem Nome"}</span>
                    <span class="text-xs ml-2 px-2 py-0.5 rounded text-white ${tipo === 'pdm' ? 'bg-purple-800' : 'bg-blue-800'}">${tipo.toUpperCase()}</span>
                    <div class="text-xs text-black/70">ID: ${id} | Proprietário: ${ficha.proprietarioUid || 'Não vinculado'}</div>
                </div>
                <div class="flex gap-1 flex-wrap">
                    <button class="btn-abrir bg-blue-700 text-white text-xs px-2 py-1 rounded font-bold hover:bg-blue-800">Abrir</button>
                    <button class="btn-vincular bg-yellow-700 text-white text-xs px-2 py-1 rounded font-bold hover:bg-yellow-800">Vincular UID</button>
                    <button class="btn-duplicar bg-green-700 text-white text-xs px-2 py-1 rounded font-bold hover:bg-green-800">Duplicar</button>
                    <button class="btn-excluir bg-red-700 text-white text-xs px-2 py-1 rounded font-bold hover:bg-red-800">Excluir</button>
                </div>
            `;

            // Eventos dos botões do card
            divCard.querySelector(".btn-abrir").onclick = () => window.open(`?fichaId=${id}`, "_blank");
            divCard.querySelector(".btn-vincular").onclick = () => vincularJogador(id, ficha.proprietarioUid);
            divCard.querySelector(".btn-duplicar").onclick = () => duplicarFicha(id, ficha);
            divCard.querySelector(".btn-excluir").onclick = () => excluirFicha(id);

            listaContainer.appendChild(divCard);
        });
    } catch (err) {
        console.error("Erro ao listar fichas:", err);
        listaContainer.innerHTML = "<p class='text-center mt-4 text-red-700 font-bold'>Erro ao carregar fichas.</p>";
    }
}

async function criarPDM() {
    const nomePDM = prompt("Informe o nome do PDM:");
    if (!nomePDM) return;

    try {
        const novaFichaRef = await addDoc(collection(db, "fichas"), {
            nome: nomePDM,
            tipo: "pdm",
            criadoPor: usuarioAtual.uid,
            proprietarioUid: usuarioAtual.uid,
            dataCriacao: serverTimestamp(),
            atributos: { forca: 10, destreza: 10, constituicao: 10, inteligencia: 10, percepcao: 10, vontade: 10, carisma: 10 },
            esquiva: 0,
            movimentacao: 6,
            diario: "",
            talentos: {}
        });

        alert("PDM criado com sucesso!");
        carregarListaFichas();
    } catch (err) {
        console.error("Erro ao criar PDM:", err);
        alert("Erro ao criar PDM: " + err.message);
    }
}

async function vincularJogador(fichaId, uidAtual) {
    const novoUid = prompt("Digite o UID da conta Firebase do Jogador:", uidAtual || "");
    if (novoUid === null) return;

    try {
        await updateDoc(doc(db, "fichas", fichaId), {
            proprietarioUid: novoUid.trim()
        });
        alert("Proprietário atualizado!");
        carregarListaFichas();
    } catch (err) {
        alert("Erro ao vincular jogador: " + err.message);
    }
}

async function duplicarFicha(fichaId, dadosOriginais) {
    if (!confirm(`Deseja duplicar a ficha "${dadosOriginais.nome}"?`)) return;

    try {
        const copia = { ...dadosOriginais };
        delete copia.id;
        copia.nome = `${dadosOriginais.nome} (Cópia)`;
        copia.dataCriacao = serverTimestamp();

        await addDoc(collection(db, "fichas"), copia);
        alert("Ficha duplicada com sucesso!");
        carregarListaFichas();
    } catch (err) {
        alert("Erro ao duplicar ficha: " + err.message);
    }
}

async function excluirFicha(fichaId) {
    if (!confirm("Tem certeza que deseja excluir esta ficha permanentemente?")) return;

    try {
        await deleteDoc(doc(db, "fichas", fichaId));
        alert("Ficha excluída com sucesso!");
        carregarListaFichas();
    } catch (err) {
        alert("Erro ao excluir ficha: " + err.message);
    }
}
