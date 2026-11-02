import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInAnonymously,
    onAuthStateChanged,
    signOut
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
    writeBatch,
    runTransaction,
    Timestamp,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ======================================================
// CONFIGURAÇÃO FIREBASE
// ======================================================

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

const emailMestre = "rpggrupoc5@gmail.com";

let usuarioAtual = null;
let fichaAtualId = null;
let fichaAtualTipo = "jogador";
let fichaAtualProprietarioUid = null;
let fichaAtualCriadoPor = null;
let ehMestreAtual = false;
let processandoConvite = false;

// ======================================================
// ELEMENTOS E UTILITÁRIOS
// ======================================================

const $ = id => document.getElementById(id);

function ehMestre() {
    return !!usuarioAtual &&
        (usuarioAtual.email || "").trim().toLowerCase() === emailMestre.toLowerCase();
}

function mostrarErro(mensagem) {
    console.error(mensagem);
    alert(mensagem);
}

function criarBotaoPainel(texto, classe, acao) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = texto;
    botao.className = `px-2 py-1 rounded text-xs font-bold text-white ${classe}`;
    botao.addEventListener("click", acao);
    return botao;
}

function criarElemento(tag, classe, texto) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texto !== undefined) el.textContent = texto;
    return el;
}

// ======================================================
// ATRIBUTOS - AÇÃO%
// ======================================================

const forca = $("forca");
const destreza = $("destreza");
const forcaAcao = $("forca-acao");
const destrezaAcao = $("destreza-acao");

function calcular() {
    if (forca && forcaAcao) {
        forcaAcao.value = forca.value ? parseInt(forca.value) * 3 : "";
    }

    if (destreza && destrezaAcao) {
        destrezaAcao.value = destreza.value ? parseInt(destreza.value) * 3 : "";
    }
}

if (forca) forca.addEventListener("input", calcular);
if (destreza) destreza.addEventListener("input", calcular);

// ======================================================
// LOGIN
// ======================================================

const telaLogin = $("tela-login");
const sitePrincipal = $("site-principal");
const mensagemErro = $("mensagem-erro");

if ($("btn-entrar")) {
    $("btn-entrar").onclick = () => {
        const email = $("login-email").value;
        const senha = $("login-senha").value;

        signInWithEmailAndPassword(auth, email, senha).catch(error => {
            console.error(error);
            mensagemErro.innerText =
                `Erro no login (${error.code || "desconhecido"}): ${error.message}`;
            mensagemErro.classList.remove("hidden");
        });
    };
}

if ($("btn-cadastrar")) {
    $("btn-cadastrar").onclick = () => {
        const email = $("login-email").value;
        const senha = $("login-senha").value;

        createUserWithEmailAndPassword(auth, email, senha)
            .then(() => alert("Conta criada! Bem-vindo."))
            .catch(error => {
                console.error(error);
                mensagemErro.innerText =
                    `Erro no cadastro (${error.code || "desconhecido"}): ${error.message}`;
                mensagemErro.classList.remove("hidden");
            });
    };
}

if ($("btn-sair")) {
    $("btn-sair").onclick = () =>
        signOut(auth).then(() => window.location.reload());
}

// ======================================================
// CONVITES - ENTRADA DO CONVIDADO
// ======================================================

async function processarConvite(token) {
    if (processandoConvite) return;
    processandoConvite = true;

    try {
        let usuario = auth.currentUser;

        if (!usuario) {
            const resultado = await signInAnonymously(auth);
            usuario = resultado.user;
        }

        const conviteRef = doc(db, "convites", token);

        const fichaId = await runTransaction(db, async transacao => {
            const conviteSnap = await transacao.get(conviteRef);

            if (!conviteSnap.exists()) {
                throw new Error("Este convite não existe.");
            }

            const convite = conviteSnap.data();

            if (convite.usado) {
                throw new Error("Este convite já foi utilizado.");
            }

            if (!convite.expiraEm || convite.expiraEm.toDate() <= new Date()) {
                throw new Error("Este convite expirou.");
            }

            transacao.update(conviteRef, {
                usado: true,
                usadoPor: usuario.uid,
                usadoEm: serverTimestamp()
            });

            return convite.fichaId;
        });

        await setDoc(
            doc(db, "fichas", fichaId, "solicitacoes", usuario.uid),
            {
                uid: usuario.uid,
                status: "pendente",
                conviteId: token,
                solicitadoEm: serverTimestamp()
            }
        );

        const url = new URL(window.location.href);
        url.searchParams.delete("convite");
        url.searchParams.set("ficha", fichaId);
        window.history.replaceState({}, "", url.toString());

        mostrarTelaAguardandoAprovacao();

    } catch (error) {
        console.error("Erro no convite:", error);
        alert(error.message || "Não foi possível utilizar este convite.");
        await signOut(auth);
        window.location.href = window.location.pathname;
    } finally {
        processandoConvite = false;
    }
}

function mostrarTelaAguardandoAprovacao() {
    if (sitePrincipal) sitePrincipal.classList.add("hidden");
    if (telaLogin) telaLogin.classList.add("hidden");

    let aviso = $("aviso-convidado");

    if (!aviso) {
        aviso = document.createElement("div");
        aviso.id = "aviso-convidado";
        aviso.className =
            "fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-5 text-center";

        aviso.innerHTML = `
            <div class="bg-[#e7dcc2] text-[#211810] rounded-lg p-8 max-w-md w-full">
                <h2 class="text-2xl font-bold mb-4">SOLICITAÇÃO ENVIADA</h2>
                <p class="mb-5">
                    Sua solicitação foi enviada ao Mestre.
                    Aguarde a aprovação para acessar a ficha.
                </p>
                <button id="btn-sair-convidado"
                    class="bg-[#3a2e27] text-white px-5 py-3 rounded font-bold">
                    SAIR
                </button>
            </div>
        `;

        document.body.appendChild(aviso);

        $("btn-sair-convidado").onclick = async () => {
            await signOut(auth);
            window.location.href = window.location.pathname;
        };
    }

    aviso.classList.remove("hidden");
}

// ======================================================
// AUTENTICAÇÃO E ABERTURA DA FICHA
// ======================================================

onAuthStateChanged(auth, async user => {
    usuarioAtual = user;
    ehMestreAtual = ehMestre();

    const parametros = new URLSearchParams(window.location.search);
    const tokenConvite = parametros.get("convite");

    if (tokenConvite && user && user.isAnonymous) {
        // Evita processar novamente um convite já consumido.
        const conviteRef = doc(db, "convites", tokenConvite);

        try {
            const conviteSnap = await getDoc(conviteRef);

            if (conviteSnap.exists() && !conviteSnap.data().usado) {
                await processarConvite(tokenConvite);
                return;
            }

            const fichaSolicitada = parametros.get("ficha");

            if (fichaSolicitada) {
                mostrarTelaAguardandoAprovacao();
                return;
            }

            throw new Error("Convite inválido ou já utilizado.");
        } catch (error) {
            console.error(error);
            alert(error.message || "Não foi possível verificar o convite.");
            return;
        }
    }

    if (!user) {
        if (telaLogin) telaLogin.classList.remove("hidden");
        if (sitePrincipal) sitePrincipal.classList.add("hidden");
        return;
    }

    if (telaLogin) telaLogin.classList.add("hidden");
    if (sitePrincipal) sitePrincipal.classList.remove("hidden");

    const btnMestre = $("btn-painel-mestre");

    if (btnMestre) {
        btnMestre.classList.toggle("hidden", !ehMestreAtual);
        btnMestre.style.display = ehMestreAtual ? "block" : "none";
    }

    if (user.isAnonymous && !tokenConvite) {
        mostrarTelaAguardandoAprovacao();
        return;
    }

    const fichaSolicitada = parametros.get("ficha");

    if (fichaSolicitada) {
        fichaAtualId = fichaSolicitada;

        try {
            await carregarFicha();
        } catch (error) {
            console.error(error);
            alert(
                "Não foi possível abrir esta ficha. " +
                "Ela pode estar aguardando aprovação ou você não possui acesso."
            );
        }
    } else if (ehMestreAtual) {
        fichaAtualId = null;
        prepararFichaNovaMestre();
    } else {
        await listarFichasDoJogador();
    }
});

// ======================================================
// LISTAGEM DE FICHAS DO JOGADOR
// ======================================================

async function listarFichasDoJogador() {
    const fichas = new Map();

    try {
        // Ficha antiga cujo ID é o próprio UID.
        const propria = await getDoc(doc(db, "fichas", usuarioAtual.uid));

        if (propria.exists()) {
            fichas.set(propria.id, propria);
        }

        // Fichas adicionais vinculadas pelo Mestre.
        const vinculadas = await getDocs(query(
            collection(db, "fichas"),
            where("proprietarioUid", "==", usuarioAtual.uid)
        ));

        vinculadas.forEach(item => fichas.set(item.id, item));

        if (fichas.size === 1) {
            fichaAtualId = [...fichas.keys()][0];
            await carregarFicha();
            return;
        }

        if (fichas.size > 1) {
            mostrarSeletorDeFichas([...fichas.values()]);
            return;
        }

        // Nenhuma ficha encontrada: cria a ficha pessoal vazia.
        fichaAtualId = usuarioAtual.uid;
        fichaAtualTipo = "jogador";
        fichaAtualProprietarioUid = usuarioAtual.uid;
        fichaAtualCriadoPor = usuarioAtual.uid;

        prepararFichaNovaJogador();

    } catch (error) {
        console.error(error);
        alert(`Erro ao buscar suas fichas: ${error.message}`);
    }
}

function mostrarSeletorDeFichas(documentos) {
    if (sitePrincipal) sitePrincipal.classList.add("hidden");

    let seletor = $("seletor-fichas");

    if (!seletor) {
        seletor = document.createElement("div");
        seletor.id = "seletor-fichas";
        seletor.className =
            "fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-5";

        document.body.appendChild(seletor);
    }

    seletor.innerHTML = `
        <div class="bg-[#e7dcc2] text-[#211810] rounded-lg p-6 max-w-lg w-full">
            <h2 class="text-2xl font-bold mb-4">ESCOLHA SUA FICHA</h2>
            <div id="opcoes-fichas" class="flex flex-col gap-3"></div>
        </div>
    `;

    const opcoes = $("opcoes-fichas");

    documentos.forEach(documento => {
        const dados = documento.data();

        const botao = criarBotaoPainel(
            `${dados.nome || "Personagem sem nome"} - Nível ${dados.nivel || 1}`,
            "bg-[#3a2e27] w-full p-3 text-left",
            async () => {
                fichaAtualId = documento.id;
                seletor.remove();
                if (sitePrincipal) sitePrincipal.classList.remove("hidden");
                await carregarFicha();
            }
        );

        opcoes.appendChild(botao);
    });
}

function prepararFichaNovaJogador() {
    fichaAtualTipo = "jogador";
    fichaAtualProprietarioUid = usuarioAtual.uid;
    fichaAtualCriadoPor = usuarioAtual.uid;
    limparFormularioFicha();
}

function prepararFichaNovaMestre() {
    fichaAtualTipo = "pdm";
    fichaAtualProprietarioUid = null;
    fichaAtualCriadoPor = usuarioAtual.uid;
    limparFormularioFicha();
}

function limparFormularioFicha() {
    const campos = [
        "nome", "idade", "nivel", "exp", "forca", "destreza",
        "constituicao", "inteligencia", "percepcao", "vontade",
        "carisma", "esquiva", "diario"
    ];

    campos.forEach(id => {
        if ($(id)) $(id).value = "";
    });

    if ($("movimentacao")) $("movimentacao").value = "6";

    calcular();
    recalcularPesoTotal();
}

// ======================================================
// COMPRESSÃO E SELEÇÃO DE IMAGENS
// ======================================================

function comprimirImagem(dataUrl) {
    return new Promise((resolve, reject) => {
        const imagem = new Image();

        imagem.onload = () => {
            const limite = 1000;
            let largura = imagem.width;
            let altura = imagem.height;

            if (largura > limite || altura > limite) {
                const proporcao = Math.min(limite / largura, limite / altura);
                largura = Math.round(largura * proporcao);
                altura = Math.round(altura * proporcao);
            }

            const canvas = document.createElement("canvas");
            canvas.width = largura;
            canvas.height = altura;

            const contexto = canvas.getContext("2d");
            contexto.drawImage(imagem, 0, 0, largura, altura);

            resolve(canvas.toDataURL("image/webp", 0.78));
        };

        imagem.onerror = () =>
            reject(new Error("Não foi possível processar esta imagem."));

        imagem.src = dataUrl;
    });
}

window.abrirSeletor = function(callback) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = async event => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            alert("Selecione um arquivo de imagem.");
            return;
        }

        const reader = new FileReader();

        reader.onload = async e => {
            try {
                const imagem = await comprimirImagem(e.target.result);
                callback(imagem);
            } catch (error) {
                console.error(error);
                alert("Não foi possível preparar a imagem.");
            }
        };

        reader.readAsDataURL(file);
    };

    input.click();
};

window.uploadFoto = function(elemento) {
    window.abrirSeletor(imgBase64 => {
        elemento.innerHTML = `
            <img src="${imgBase64}"
                style="width:100%;height:100%;object-fit:cover;
                object-position:top center;position:absolute;top:0;left:0;
                z-index:1;pointer-events:none;">
        `;

        elemento.onclick = null;

        const btn = document.createElement("div");
        btn.textContent = "X";
        btn.className =
            "absolute top-2 right-2 bg-red-800 text-white rounded-full " +
            "w-6 h-6 flex items-center justify-center cursor-pointer z-20 " +
            "text-sm font-bold shadow-lg opacity-0 transition-opacity " +
            "duration-300 pointer-events-none";

        btn.onclick = event => {
            event.stopPropagation();
            elemento.innerHTML = `
                <i class="fa-solid fa-camera text-4xl text-black/20 mb-2"></i>
                <span>FOTO DO<br>PERSONAGEM</span>
                <div class="texto-proporcao">PROPORÇÃO IDEAL: 9x16</div>
            `;
            elemento.onclick = () => window.uploadFoto(elemento);
        };

        elemento.appendChild(btn);

        let timer;

        elemento.onmouseenter = () => {
            clearTimeout(timer);
            btn.classList.remove("opacity-0");
            btn.classList.add("opacity-100");
        };

        elemento.onmouseleave = () => {
            timer = setTimeout(() => {
                btn.classList.add("opacity-0");
                btn.classList.remove("opacity-100");
            }, 1500);
        };
    });
};

// ======================================================
// INVENTÁRIO E EQUIPAMENTOS
// ======================================================

const gridInv = $("inventario");
const espacosEl = $("espacos");
const pesoEl = $("peso-total");

let quadradoAtual = null;
let imagemAtualBase64 = null;

function recalcularPesoTotal() {
    let pesoTotal = 0;

    document.querySelectorAll(".item-adicionado").forEach(item => {
        const qtd = parseFloat(item.dataset.qtd) || 1;
        const peso = (item.dataset.peso || "0").toString().replace(",", ".");
        pesoTotal += qtd * (parseFloat(peso) || 0);
    });

    if (pesoEl) pesoEl.innerText = pesoTotal.toFixed(2);

    if (espacosEl) {
        espacosEl.innerText =
            document.querySelectorAll("#inventario .item-adicionado").length;
    }
}

const modalHTML = `
<div id="modal-item"
    class="fixed inset-0 bg-black/80 z-50 flex justify-center items-center hidden">
    <div class="painel-papel p-6 rounded-lg w-[400px] max-w-[95vw]
        flex flex-col gap-3 relative">

        <h3 class="fonte-titulo text-2xl text-[#111]
            border-b border-black/30 pb-2 mb-2">DADOS DO ITEM</h3>

        <div class="flex gap-4">
            <div id="modal-preview"
                class="w-24 h-24 rounded flex flex-col justify-center
                items-center relative overflow-hidden text-black/30
                border-2 border-dashed border-[#3a2e27] bg-black/10">
                <i class="fa-solid fa-camera text-2xl mb-1"></i>
                <span class="text-[9px] font-bold text-center">SEM IMAGEM</span>
            </div>

            <div class="flex-1 flex flex-col gap-2">
                <label class="flex flex-col text-sm font-bold text-[#111]">
                    Nome do Item:
                    <input type="text" id="modal-nome" class="input-campo p-2">
                </label>
                <button id="btn-upload"
                    class="bg-[#3a2e27] text-white p-2 rounded font-bold text-sm">
                    <i class="fa-solid fa-camera"></i> Escolher Imagem
                </button>
            </div>
        </div>

        <div class="flex gap-2">
            <label class="flex flex-col text-sm font-bold text-[#111] flex-1">
                Quantidade:
                <input type="number" id="modal-qtd" value="1" class="input-campo p-2">
            </label>
            <label class="flex flex-col text-sm font-bold text-[#111] flex-1">
                Peso Unit. (kg):
                <input type="text" id="modal-peso" class="input-campo p-2">
            </label>
        </div>

        <label class="flex flex-col text-sm font-bold text-[#111]">
            Descrição:
            <textarea id="modal-desc"
                class="input-campo p-2 resize-none h-16"></textarea>
        </label>

        <div class="flex justify-between mt-2 gap-2">
            <button id="btn-excluir"
                class="bg-gray-600 text-white p-2 rounded font-bold flex-1 hidden">
                Excluir
            </button>
            <button id="btn-cancelar"
                class="bg-gray-600 text-white p-2 rounded font-bold flex-1">
                Cancelar
            </button>
            <button id="btn-salvar-item"
                class="bg-[#a81c1c] text-white p-2 rounded font-bold flex-1">
                Salvar
            </button>
        </div>
    </div>
</div>
`;

document.body.insertAdjacentHTML("beforeend", modalHTML);

const modal = $("modal-item");
const modalPreview = $("modal-preview");
const inputNome = $("modal-nome");
const inputQtd = $("modal-qtd");
const inputPeso = $("modal-peso");
const inputDesc = $("modal-desc");
const btnExcluir = $("btn-excluir");
const btnCancelar = $("btn-cancelar");
const btnSalvarItem = $("btn-salvar-item");
const btnUpload = $("btn-upload");

function atualizarPreviewModal() {
    if (imagemAtualBase64) {
        modalPreview.innerHTML = `
            <img src="${imagemAtualBase64}"
                style="width:100%;height:100%;object-fit:contain;padding:4px;">
            <button id="btn-remover-img-modal"
                class="absolute top-1 right-1 bg-red-800 text-white
                rounded-full w-5 h-5">X</button>
        `;

        modalPreview.classList.remove("border-dashed");
        modalPreview.classList.add("border-solid");

        $("btn-remover-img-modal").onclick = event => {
            event.preventDefault();
            imagemAtualBase64 = null;
            atualizarPreviewModal();
        };
    } else {
        modalPreview.innerHTML = `
            <i class="fa-solid fa-camera text-2xl mb-1"></i>
            <span class="text-[9px] font-bold text-center">SEM IMAGEM</span>
        `;
        modalPreview.classList.add("border-dashed");
        modalPreview.classList.remove("border-solid");
    }
}

function abrirModal(q, dados = null) {
    quadradoAtual = q;

    if (dados && dados.nome) {
        inputNome.value = dados.nome;
        inputQtd.value = dados.qtd;
        inputPeso.value = dados.peso;
        inputDesc.value = dados.desc || "";
        imagemAtualBase64 = dados.img || null;
        btnExcluir.classList.remove("hidden");
        document.querySelector("#modal-item h3").innerText = "EDITAR ITEM";
        btnSalvarItem.innerText = "SALVAR";
    } else {
        inputNome.value = "";
        inputQtd.value = 1;
        inputPeso.value = "";
        inputDesc.value = "";
        imagemAtualBase64 = null;
        btnExcluir.classList.add("hidden");
        document.querySelector("#modal-item h3").innerText = "NOVO ITEM";
        btnSalvarItem.innerText = "ADICIONAR";
    }

    atualizarPreviewModal();
    modal.classList.remove("hidden");
}

btnCancelar.onclick = () => modal.classList.add("hidden");

btnUpload.onclick = () => {
    window.abrirSeletor(img => {
        imagemAtualBase64 = img;
        atualizarPreviewModal();
    });
};

btnExcluir.onclick = () => {
    if (!quadradoAtual) return;

    if (quadradoAtual.id.startsWith("inv-")) {
        quadradoAtual.innerHTML =
            '<span class="text-2xl text-black/20">+</span>';
    } else {
        quadradoAtual.innerHTML =
            quadradoAtual.getAttribute("data-original") +
            '<span class="text-lg text-black/30">' +
            '<i class="fa-solid fa-upload"></i></span>';
    }

    quadradoAtual.classList.remove("item-adicionado");
    quadradoAtual.removeAttribute("data-itemData");
    quadradoAtual.removeAttribute("data-peso");
    quadradoAtual.removeAttribute("data-qtd");

    recalcularPesoTotal();
    modal.classList.add("hidden");
};

btnSalvarItem.onclick = () => {
    const nome = inputNome.value;
    const pesoString = inputPeso.value.replace(",", ".");
    const qtd = parseInt(inputQtd.value) || 0;

    if (!imagemAtualBase64) return alert("Escolha uma imagem.");
    if (!nome.trim()) return alert("Digite o nome.");
    if (qtd <= 0) return alert("Quantidade deve ser maior que zero.");
    if (inputPeso.value.trim() === "") return alert("Digite o peso.");

    const dados = {
        img: imagemAtualBase64,
        nome,
        qtd,
        peso: pesoString,
        desc: inputDesc.value
    };

    renderizarItem(quadradoAtual, dados);
    recalcularPesoTotal();
    modal.classList.add("hidden");
};

function renderizarItem(q, dados) {
    const isEquipamento = !q.id.startsWith("inv-");

    const classeTexto = isEquipamento
        ? "opacity-0 group-hover:opacity-100 transition-opacity"
        : "opacity-100";

    q.innerHTML = `
        ${dados.img ? `<img src="${dados.img}"
            style="width:100%;height:100%;object-fit:contain;
            position:absolute;top:0;left:0;padding:4px;z-index:1;">` : ""}

        <div class="text-[10px] font-bold bg-black/40 text-white px-1
            rounded leading-tight w-full absolute bottom-0 left-0 z-10
            text-center ${classeTexto}">
            ${dados.nome}<br>
            <span class="text-gray-300">Qtd: ${dados.qtd}</span> |
            <span class="text-gray-300">${dados.peso}kg</span>
        </div>

        <div class="absolute inset-0 bg-black/80 text-white text-[10px]
            p-1 opacity-0 group-hover:opacity-100 transition-opacity
            flex flex-col justify-center items-center pointer-events-none z-20">
            <span class="font-bold mb-1">EDITAR</span>
            ${dados.desc
                ? `<span class="italic text-gray-300 truncate w-full
                    text-center">"${dados.desc}"</span>`
                : ""}
        </div>
    `;

    q.classList.add("item-adicionado");
    q.dataset.itemData = JSON.stringify(dados);
    q.dataset.peso = dados.peso;
    q.dataset.qtd = dados.qtd;
}

if (gridInv) {
    for (let i = 0; i < 16; i++) {
        const q = document.createElement("div");

        q.id = `inv-${i}`;
        q.className =
            "slot-vazio rounded aspect-square flex flex-col justify-center " +
            "items-center relative text-center p-1 overflow-hidden group";

        q.innerHTML = '<span class="text-2xl text-black/20">+</span>';

        q.onclick = () => {
            if (q.classList.contains("item-adicionado")) {
                abrirModal(q, JSON.parse(q.dataset.itemData));
            } else {
                abrirModal(q);
            }
        };

        gridInv.appendChild(q);
    }
}

const slotsEquipamento =
    document.querySelectorAll(".slot-vazio:not(#inventario .slot-vazio)");

slotsEquipamento.forEach(slot => {
    if (!slot.classList.contains("foto-personagem")) {
        slot.setAttribute("data-original", slot.innerHTML.split("<span")[0]);
        slot.removeAttribute("onclick");

        slot.onclick = () => {
            if (slot.classList.contains("item-adicionado")) {
                abrirModal(slot, JSON.parse(slot.dataset.itemData));
            } else {
                abrirModal(slot);
            }
        };
    }
});

// ======================================================
// TALENTOS
// ======================================================

const listaT = $("talentos");

if (listaT) {
    for (let i = 1; i <= 20; i++) {
        const linha = document.createElement("div");
        linha.className =
            "flex items-center gap-2 border-b border-black/20 pb-1";

        linha.innerHTML = `
            <span class="font-bold w-5 text-right text-[#111] text-sm">
                ${i}.
            </span>
            <input type="text"
                class="bg-transparent border-none outline-none font-semibold
                text-[#111] text-base w-full">
        `;

        listaT.appendChild(linha);
    }
}

// ======================================================
// IMAGENS SEPARADAS NO FIRESTORE
// ======================================================

function imagemEhBase64(valor) {
    return typeof valor === "string" && valor.startsWith("data:image/");
}

async function salvarImagemSeparada(idImagem, dadosImagem) {
    if (!dadosImagem) return;

    await setDoc(
        doc(db, "fichas", fichaAtualId, "imagens", idImagem),
        { imagem: dadosImagem }
    );
}

async function carregarImagensSeparadas() {
    const snapshot = await getDocs(
        collection(db, "fichas", fichaAtualId, "imagens")
    );

    const imagens = {};

    snapshot.forEach(documento => {
        imagens[documento.id] = documento.data().imagem || "";
    });

    return imagens;
}

// ======================================================
// SALVAR FICHA
// ======================================================

if ($("btn-salvar-ficha")) {
    $("btn-salvar-ficha").onclick = async () => {
        if (!usuarioAtual || !fichaAtualId) {
            return alert("Nenhuma ficha selecionada.");
        }

        const botao = $("btn-salvar-ficha");
        const textoOriginal = botao.innerText;

        botao.disabled = true;
        botao.innerText = "SALVANDO...";

        try {
            // IMPORTANTE:
            // Jogadores e convidados não enviam metadados administrativos.
            // O merge preserva os metadados já existentes na ficha.

            const dadosFicha = {
                nome: $("nome").value,
                idade: $("idade").value,
                nivel: $("nivel").value,
                exp: $("exp").value,

                forca: forca.value,
                destreza: destreza.value,
                forcaAcao: forcaAcao.value,
                destrezaAcao: destrezaAcao.value,

                constituicao: $("constituicao").value,
                inteligencia: $("inteligencia").value,
                percepcao: $("percepcao").value,
                vontade: $("vontade").value,
                carisma: $("carisma").value,
                esquiva: $("esquiva").value,
                movimentacao: $("movimentacao").value,
                diario: $("diario").value,

                talentos: Array.from(
                    document.querySelectorAll("#talentos input")
                ).map(input => input.value),

                fotoPersonagem: "",
                itensMochila: [],
                itensEquipamento: []
            };

            const imagensAtivas = {};

            // O Mestre mantém os metadados administrativos.
            if (ehMestre()) {
                dadosFicha.tipo = fichaAtualTipo;
                dadosFicha.proprietarioUid = fichaAtualProprietarioUid;
                dadosFicha.criadoPor =
                    fichaAtualCriadoPor || usuarioAtual.uid;
            }

            // FOTO DO PERSONAGEM
            const fotoContainer = $("foto-personagem");
            const imagemRetrato = fotoContainer?.querySelector("img");

            if (imagemRetrato) {
                const foto = imagemRetrato.getAttribute("src");

                if (imagemEhBase64(foto)) {
                    imagensAtivas.personagem = foto;
                }

                dadosFicha.fotoPersonagem =
                    fotoContainer.innerHTML.replace(
                        foto,
                        "__IMAGEM_PERSONAGEM__"
                    );
            } else if (fotoContainer) {
                dadosFicha.fotoPersonagem = fotoContainer.innerHTML;
            }

            // ITENS DA MOCHILA
            const itensMochila =
                document.querySelectorAll("#inventario .item-adicionado");

            for (const el of itensMochila) {
                const dados = JSON.parse(el.dataset.itemData);
                const imagemId = `mochila_${el.id}`;

                if (dados.img) imagensAtivas[imagemId] = dados.img;

                dadosFicha.itensMochila.push({
                    dados: {
                        nome: dados.nome,
                        qtd: dados.qtd,
                        peso: dados.peso,
                        desc: dados.desc || "",
                        img: ""
                    },
                    imagemId,
                    posicao: el.id
                });
            }

            // EQUIPAMENTOS
            const todosSlots =
                Array.from(document.querySelectorAll(".slot-vazio"));

            const itensEquipamento =
                document.querySelectorAll(".slot-vazio.item-adicionado");

            for (const el of itensEquipamento) {
                const dados = JSON.parse(el.dataset.itemData);
                const indice = todosSlots.indexOf(el);
                const imagemId = `equipamento_${indice}`;

                if (dados.img) imagensAtivas[imagemId] = dados.img;

                dadosFicha.itensEquipamento.push({
                    dados: {
                        nome: dados.nome,
                        qtd: dados.qtd,
                        peso: dados.peso,
                        desc: dados.desc || "",
                        img: ""
                    },
                    imagemId,
                    posicao: el.getAttribute("data-original")
                });
            }

            // SALVA IMAGENS
            for (const [idImagem, imagem] of Object.entries(imagensAtivas)) {
                await salvarImagemSeparada(idImagem, imagem);
            }

            // REMOVE IMAGENS QUE NÃO ESTÃO MAIS EM USO
            const imagensAntigas = await getDocs(
                collection(db, "fichas", fichaAtualId, "imagens")
            );

            for (const documento of imagensAntigas.docs) {
                if (!imagensAtivas[documento.id]) {
                    await deleteDoc(documento.ref);
                }
            }

            // MERGE: preserva os metadados administrativos.
            await setDoc(
                doc(db, "fichas", fichaAtualId),
                dadosFicha,
                { merge: true }
            );

            alert("Ficha salva com sucesso!");

        } catch (error) {
            console.error("Falha ao salvar ficha:", error);

            alert(
                `Erro ao salvar ficha (${error.code || "desconhecido"}): ` +
                error.message
            );
        } finally {
            botao.disabled = false;
            botao.innerText = textoOriginal;
        }
    };
}

// ======================================================
// CARREGAR FICHA
// ======================================================

async function carregarFicha() {
    if (!usuarioAtual || !fichaAtualId) return;

    const docSnap = await getDoc(doc(db, "fichas", fichaAtualId));

    if (!docSnap.exists()) {
        throw new Error("Ficha não encontrada.");
    }

    const d = docSnap.data();

    fichaAtualTipo = d.tipo || "jogador";
    fichaAtualProprietarioUid =
        d.proprietarioUid || (fichaAtualId === usuarioAtual.uid
            ? usuarioAtual.uid
            : null);

    fichaAtualCriadoPor = d.criadoPor || fichaAtualProprietarioUid || null;

    const imagensSeparadas = await carregarImagensSeparadas();

    $("nome").value = d.nome || "";
    $("idade").value = d.idade || "";
    $("nivel").value = d.nivel || "";
    $("exp").value = d.exp || "";

    forca.value = d.forca || "";
    destreza.value = d.destreza || "";
    calcular();

    $("constituicao").value = d.constituicao || "";
    $("inteligencia").value = d.inteligencia || "";
    $("percepcao").value = d.percepcao || "";
    $("vontade").value = d.vontade || "";
    $("carisma").value = d.carisma || "";
    $("esquiva").value = d.esquiva || "";
    $("movimentacao").value = d.movimentacao || 6;
    $("diario").value = d.diario || "";

    const camposTalentos = document.querySelectorAll("#talentos input");

    camposTalentos.forEach((input, indice) => {
        input.value = (d.talentos || [])[indice] || "";
    });

    // FOTO
    if (d.fotoPersonagem && d.fotoPersonagem.includes("img")) {
        let fotoHTML = d.fotoPersonagem;

        if (imagensSeparadas.personagem) {
            fotoHTML = fotoHTML.replace(
                "__IMAGEM_PERSONAGEM__",
                imagensSeparadas.personagem
            );
        }

        $("foto-personagem").innerHTML = fotoHTML;
    } else if (d.fotoPersonagem) {
        $("foto-personagem").innerHTML = d.fotoPersonagem;
    }

    // LIMPA ITENS ANTERIORES
    document.querySelectorAll(".item-adicionado").forEach(el => {
        el.classList.remove("item-adicionado");
        el.removeAttribute("data-itemData");
        el.removeAttribute("data-peso");
        el.removeAttribute("data-qtd");
    });

    // MOCHILA
    (d.itensMochila || []).forEach(item => {
        const el = $(item.posicao);

        if (!el) return;

        const dados = { ...item.dados };

        if (item.imagemId && imagensSeparadas[item.imagemId]) {
            dados.img = imagensSeparadas[item.imagemId];
        }

        if (!dados.img && item.dados.img) {
            dados.img = item.dados.img;
        }

        renderizarItem(el, dados);
    });

    // EQUIPAMENTOS
    (d.itensEquipamento || []).forEach(item => {
        const el = Array.from(document.querySelectorAll(".slot-vazio"))
            .find(e => e.getAttribute("data-original") === item.posicao);

        if (!el) return;

        const dados = { ...item.dados };

        if (item.imagemId && imagensSeparadas[item.imagemId]) {
            dados.img = imagensSeparadas[item.imagemId];
        }

        if (!dados.img && item.dados.img) {
            dados.img = item.dados.img;
        }

        renderizarItem(el, dados);
    });

    recalcularPesoTotal();
}

// ======================================================
// PAINEL DO MESTRE
// ======================================================

function abrirFichaEmNovaAba(idFicha) {
    const url = new URL(window.location.href);
    url.searchParams.delete("convite");
    url.searchParams.set("ficha", idFicha);
    window.open(url.toString(), "_blank");
}

async function atualizarPainelMestre() {
    if (!ehMestre()) return;

    const lista = $("lista-jogadores");
    if (!lista) return;

    lista.textContent = "Buscando fichas...";

    try {
        const snapshot = await getDocs(collection(db, "fichas"));
        lista.innerHTML = "";

        if (snapshot.empty) {
            lista.textContent = "Nenhuma ficha cadastrada ainda.";
            return;
        }

        const fichasOrdenadas = [...snapshot.docs].sort((a, b) =>
            (a.data().nome || "").localeCompare(
                b.data().nome || "",
                "pt-BR"
            )
        );

        for (const documento of fichasOrdenadas) {
            const ficha = documento.data();
            const idFicha = documento.id;
            const tipo = ficha.tipo || "jogador";

            const proprietario =
                ficha.proprietarioNome ||
                ficha.proprietarioEmail ||
                (ficha.proprietarioUid
                    ? `Conta vinculada (${ficha.proprietarioUid.slice(0, 8)}...)`
                    : tipo === "jogador"
                        ? `Conta antiga (${idFicha.slice(0, 8)}...)`
                        : "Sem proprietário");

            const linha = criarElemento(
                "div",
                "border-b border-black/20 p-3 mb-2 flex flex-col gap-2 bg-white/30 rounded"
            );

            const topo = criarElemento(
                "div",
                "flex flex-wrap justify-between gap-2 items-start"
            );

            const info = criarElemento("div", "min-w-0");

            const nome = criarElemento(
                "strong",
                "text-lg",
                ficha.nome || "Sem nome"
            );

            const detalhes = criarElemento(
                "div",
                "text-sm",
                `${tipo === "pdm" ? "PDM" : "Jogador"} | Nível ${ficha.nivel || 1} | Força ${ficha.forca || "-"} (${ficha.forcaAcao || 0}%)`
            );

            const dono = criarElemento(
                "div",
                "text-xs opacity-80",
                `Proprietário: ${proprietario}`
            );

            info.append(nome, detalhes, dono);

            const abrir = criarBotaoPainel(
                "ABRIR",
                "bg-[#3a2e27]",
                () => abrirFichaEmNovaAba(idFicha)
            );

            topo.append(info, abrir);

            const acoes = criarElemento("div", "flex flex-wrap gap-2");

            acoes.append(
                criarBotaoPainel(
                    "EDITAR",
                    "bg-[#7a4e32]",
                    () => abrirFichaEmNovaAba(idFicha)
                ),
                criarBotaoPainel(
                    "DUPLICAR",
                    "bg-blue-800",
                    () => duplicarFicha(idFicha, ficha)
                ),
                criarBotaoPainel(
                    "VINCULAR JOGADOR",
                    "bg-green-800",
                    () => vincularJogador(idFicha, ficha)
                ),
                criarBotaoPainel(
                    "DESVINCULAR",
                    "bg-gray-700",
                    () => desvincularJogador(idFicha, ficha)
                ),
                criarBotaoPainel(
                    "CONVIDAR",
                    "bg-purple-800",
                    () => criarConvite(idFicha)
                ),
                criarBotaoPainel(
                    "SOLICITAÇÕES",
                    "bg-indigo-800",
                    () => mostrarSolicitacoes(idFicha, ficha.nome || "Ficha")
                ),
                criarBotaoPainel(
                    "EXCLUIR",
                    "bg-red-800",
                    () => excluirFicha(idFicha, ficha)
                )
            );

            linha.append(topo, acoes);
            lista.appendChild(linha);
        }

    } catch (error) {
        console.error(error);
        lista.textContent =
            `Erro ao carregar fichas (${error.code || "desconhecido"}): ${error.message}`;
    }
}

// ======================================================
// CRIAR CONVITE
// ======================================================

async function criarConvite(idFicha) {
    if (!ehMestre()) return;

    try {
        const token = crypto.randomUUID().replace(/-/g, "");

        const expiraEm = Timestamp.fromDate(
            new Date(Date.now() + 12 * 60 * 60 * 1000)
        );

        await setDoc(doc(db, "convites", token), {
            fichaId: idFicha,
            criadoPor: usuarioAtual.uid,
            criadoEm: serverTimestamp(),
            expiraEm,
            usado: false,
            usadoPor: null,
            usadoEm: null
        });

        const url = new URL(window.location.href);
        url.searchParams.delete("ficha");
        url.searchParams.set("convite", token);

        const link = url.toString();

        try {
            await navigator.clipboard.writeText(link);
            alert(
                "Convite criado e copiado!\n\n" +
                "Ele expira em 12 horas e só pode ser utilizado uma vez."
            );
        } catch {
            prompt("Copie o link do convite:", link);
        }

    } catch (error) {
        console.error(error);
        alert(`Erro ao criar convite: ${error.message}`);
    }
}

// ======================================================
// SOLICITAÇÕES DE ACESSO
// ======================================================

async function mostrarSolicitacoes(idFicha, nomeFicha) {
    if (!ehMestre()) return;

    try {
        const snapshot = await getDocs(
            collection(db, "fichas", idFicha, "solicitacoes")
        );

        const pendentes = snapshot.docs.filter(
            item => item.data().status === "pendente"
        );

        const janela = document.createElement("div");

        janela.className =
            "fixed inset-0 z-[120] bg-black/90 flex items-center " +
            "justify-center p-4";

        const painel = criarElemento(
            "div",
            "bg-[#e7dcc2] text-[#211810] rounded-lg p-5 max-w-lg w-full max-h-[85vh] overflow-y-auto"
        );

        painel.appendChild(criarElemento(
            "h2",
            "text-xl font-bold mb-4",
            `SOLICITAÇÕES: ${nomeFicha}`
        ));

        if (!pendentes.length) {
            painel.appendChild(criarElemento(
                "p",
                "mb-4",
                "Não existem solicitações pendentes."
            ));
        }

        for (const pedido of pendentes) {
            const dados = pedido.data();
            const uid = pedido.id;

            const linha = criarElemento(
                "div",
                "border-b border-black/20 py-3 flex flex-col gap-2"
            );

            linha.appendChild(criarElemento(
                "div",
                "text-sm break-all",
                `UID do convidado: ${uid}`
            ));

            const botoes = criarElemento("div", "flex gap-2");

            botoes.append(
                criarBotaoPainel(
                    "APROVAR",
                    "bg-green-800",
                    async () => {
                        await aprovarConvidado(idFicha, uid);
                        await mostrarSolicitacoes(idFicha, nomeFicha);
                        await atualizarPainelMestre();
                        janela.remove();
                    }
                ),
                criarBotaoPainel(
                    "RECUSAR",
                    "bg-red-800",
                    async () => {
                        await deleteDoc(
                            doc(db, "fichas", idFicha, "solicitacoes", uid)
                        );
                        janela.remove();
                        await mostrarSolicitacoes(idFicha, nomeFicha);
                    }
                )
            );

            linha.appendChild(botoes);
            painel.appendChild(linha);
        }

        const fechar = criarBotaoPainel(
            "FECHAR",
            "bg-gray-700 w-full mt-4 p-2",
            () => janela.remove()
        );

        painel.appendChild(fechar);
        janela.appendChild(painel);
        document.body.appendChild(janela);

    } catch (error) {
        console.error(error);
        alert(`Erro ao buscar solicitações: ${error.message}`);
    }
}

async function aprovarConvidado(idFicha, uid) {
    if (!ehMestre()) return;

    try {
        await setDoc(
            doc(db, "fichas", idFicha, "acessos", uid),
            {
                uid,
                aprovado: true,
                aprovadoPor: usuarioAtual.uid,
                aprovadoEm: serverTimestamp()
            }
        );

        await setDoc(
            doc(db, "fichas", idFicha, "solicitacoes", uid),
            {
                uid,
                status: "aprovado"
            },
            { merge: true }
        );

        alert("Convidado aprovado!");

    } catch (error) {
        console.error(error);
        alert(`Erro ao aprovar convidado: ${error.message}`);
    }
}

// ======================================================
// REVOGAR ACESSO DE CONVIDADO
// ======================================================

async function revogarConvidado(idFicha, uid) {
    if (!ehMestre()) return;

    if (!confirm("Deseja realmente retirar o acesso deste convidado?")) {
        return;
    }

    try {
        await deleteDoc(doc(db, "fichas", idFicha, "acessos", uid));

        alert("Acesso revogado.");

    } catch (error) {
        console.error(error);
        alert(`Erro ao revogar acesso: ${error.message}`);
    }
}

// ======================================================
// CRIAR PDM
// ======================================================

async function criarPDM() {
    if (!ehMestre()) return;

    const nome = prompt("Nome do novo PDM:", "Novo PDM");
    if (nome === null) return;

    try {
        const novaFicha = doc(collection(db, "fichas"));

        await setDoc(novaFicha, {
            tipo: "pdm",
            proprietarioUid: null,
            proprietarioNome: "",
            criadoPor: usuarioAtual.uid,
            nome: nome.trim() || "Novo PDM",
            idade: "",
            nivel: "1",
            exp: "",
            forca: "",
            destreza: "",
            forcaAcao: "",
            destrezaAcao: "",
            constituicao: "",
            inteligencia: "",
            percepcao: "",
            vontade: "",
            carisma: "",
            esquiva: "",
            movimentacao: "6",
            diario: "",
            talentos: [],
            fotoPersonagem: "",
            itensMochila: [],
            itensEquipamento: []
        });

        await atualizarPainelMestre();

        alert("PDM criado com sucesso!");

    } catch (error) {
        console.error(error);
        alert(`Não foi possível criar o PDM: ${error.message}`);
    }
}

// ======================================================
// EXCLUIR FICHA
// ======================================================

async function excluirFicha(idFicha, ficha) {
    if (!ehMestre()) return;

    const nome = ficha.nome || "esta ficha";

    if (!confirm(
        `Tem certeza de que deseja excluir ${nome}? Esta ação não pode ser desfeita.`
    )) return;

    try {
        const imagens = await getDocs(
            collection(db, "fichas", idFicha, "imagens")
        );

        const lote = writeBatch(db);

        imagens.forEach(item => lote.delete(item.ref));
        lote.delete(doc(db, "fichas", idFicha));

        await lote.commit();

        await atualizarPainelMestre();
        alert("Ficha e imagens excluídas.");

    } catch (error) {
        console.error(error);
        alert(`Erro ao excluir ficha: ${error.message}`);
    }
}

// ======================================================
// DUPLICAR FICHA
// ======================================================

async function duplicarFicha(idFicha, ficha) {
    if (!ehMestre()) return;

    const novoNome = prompt(
        "Nome da cópia:",
        `${ficha.nome || "Personagem"} (Cópia)`
    );

    if (novoNome === null) return;

    try {
        const imagensOrigem = await getDocs(
            collection(db, "fichas", idFicha, "imagens")
        );

        const novaRef = doc(collection(db, "fichas"));

        const copia = {
            ...ficha,
            nome: novoNome.trim() || `${ficha.nome || "Personagem"} (Cópia)`,
            tipo: "pdm",
            proprietarioUid: null,
            proprietarioNome: "",
            proprietarioEmail: "",
            criadoPor: usuarioAtual.uid
        };

        await setDoc(novaRef, copia);

        const lote = writeBatch(db);

        imagensOrigem.forEach(item => {
            lote.set(
                doc(db, "fichas", novaRef.id, "imagens", item.id),
                item.data()
            );
        });

        if (!imagensOrigem.empty) {
            await lote.commit();
        }

        await atualizarPainelMestre();
        alert("Cópia criada como PDM independente.");

    } catch (error) {
        console.error(error);
        alert(`Erro ao duplicar ficha: ${error.message}`);
    }
}

// ======================================================
// VINCULAR JOGADOR
// ======================================================

async function vincularJogador(idFicha, ficha) {
    if (!ehMestre()) return;

    const uid = prompt(
        "Informe o UID da conta Firebase do jogador:",
        ficha.proprietarioUid || ""
    );

    if (uid === null) return;

    const uidLimpo = uid.trim();

    if (!uidLimpo) {
        return alert("O UID não pode ficar vazio.");
    }

    if (uidLimpo.length < 10) {
        return alert("Esse UID parece incompleto.");
    }

    const nomeJogador = prompt(
        "Nome do jogador (opcional):",
        ficha.proprietarioNome || ""
    );

    if (nomeJogador === null) return;

    try {
        await setDoc(
            doc(db, "fichas", idFicha),
            {
                proprietarioUid: uidLimpo,
                proprietarioNome: nomeJogador.trim(),
                tipo: "jogador"
            },
            { merge: true }
        );

        await atualizarPainelMestre();

        alert("Jogador vinculado com sucesso!");

    } catch (error) {
        console.error(error);
        alert(`Erro ao vincular jogador: ${error.message}`);
    }
}

// ======================================================
// DESVINCULAR JOGADOR
// ======================================================

async function desvincularJogador(idFicha, ficha) {
    if (!ehMestre()) return;

    if (!ficha.proprietarioUid) {
        return alert("Esta ficha não possui jogador vinculado.");
    }

    if (!confirm(
        `Desvincular o jogador desta ficha (${ficha.nome || "Sem nome"})?`
    )) return;

    try {
        await setDoc(
            doc(db, "fichas", idFicha),
            {
                proprietarioUid: null,
                proprietarioNome: "",
                proprietarioEmail: "",
                tipo: "pdm"
            },
            { merge: true }
        );

        await atualizarPainelMestre();
        alert("Jogador desvinculado.");

    } catch (error) {
        console.error(error);
        alert(`Erro ao desvincular: ${error.message}`);
    }
}

// ======================================================
// BOTÕES DO PAINEL DO MESTRE
// ======================================================

const btnPainelMestre = $("btn-painel-mestre");

if (btnPainelMestre) {
    btnPainelMestre.onclick = async () => {
        $("painel-mestre").classList.remove("hidden");
        await atualizarPainelMestre();
    };
}

const btnFecharMestre = $("btn-fechar-mestre");

if (btnFecharMestre) {
    btnFecharMestre.onclick = () => {
        $("painel-mestre").classList.add("hidden");
    };
}

const btnCriarPDM = $("btn-criar-pdm");

if (btnCriarPDM) {
    btnCriarPDM.onclick = criarPDM;
}
