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

// ======================================================
// FIREBASE
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

const $ = (id) => document.getElementById(id);

function ehMestre() {
    return (usuarioAtual?.email || "").trim().toLowerCase() ===
        emailMestre.toLowerCase();
}

// ======================================================
// ATRIBUTOS E AÇÃO%
// ======================================================

const forca = $("forca");
const destreza = $("destreza");
const forcaAcao = $("forca-acao");
const destrezaAcao = $("destreza-acao");

function calcular() {
    if (forca && forcaAcao) {
        forcaAcao.value = forca.value
            ? Number(forca.value) * 3
            : "";
    }

    if (destreza && destrezaAcao) {
        destrezaAcao.value = destreza.value
            ? Number(destreza.value) * 3
            : "";
    }
}

forca?.addEventListener("input", calcular);
destreza?.addEventListener("input", calcular);

// ======================================================
// LOGIN E CADASTRO
// ======================================================

const telaLogin = $("tela-login");
const sitePrincipal = $("site-principal");
const mensagemErro = $("mensagem-erro");

function mostrarErroLogin(mensagem) {
    if (!mensagemErro) return;

    mensagemErro.textContent = mensagem;
    mensagemErro.classList.remove("hidden");
}

function limparErroLogin() {
    if (!mensagemErro) return;

    mensagemErro.textContent = "";
    mensagemErro.classList.add("hidden");
}

$("btn-entrar")?.addEventListener("click", async () => {
    limparErroLogin();

    const email = $("login-email")?.value.trim();
    const senha = $("login-senha")?.value;

    if (!email || !senha) {
        mostrarErroLogin("Informe seu e-mail e sua senha.");
        return;
    }

    const botao = $("btn-entrar");
    botao.disabled = true;
    botao.textContent = "ENTRANDO...";

    try {
        await signInWithEmailAndPassword(auth, email, senha);
    } catch (error) {
        console.error("Falha no login:", error);
        mostrarErroLogin(
            `Erro no login (${error.code || "desconhecido"}): ${error.message}`
        );
    } finally {
        botao.disabled = false;
        botao.textContent = "ENTRAR";
    }
});

$("btn-cadastrar")?.addEventListener("click", async () => {
    limparErroLogin();

    const email = $("login-email")?.value.trim();
    const senha = $("login-senha")?.value;

    if (!email || !senha) {
        mostrarErroLogin("Informe seu e-mail e sua senha.");
        return;
    }

    if (senha.length < 6) {
        mostrarErroLogin("A senha precisa ter pelo menos 6 caracteres.");
        return;
    }

    const botao = $("btn-cadastrar");
    botao.disabled = true;
    botao.textContent = "CRIANDO CONTA...";

    try {
        await createUserWithEmailAndPassword(auth, email, senha);
        alert("Conta criada com sucesso!");
    } catch (error) {
        console.error("Falha no cadastro:", error);
        mostrarErroLogin(
            `Erro no cadastro (${error.code || "desconhecido"}): ${error.message}`
        );
    } finally {
        botao.disabled = false;
        botao.textContent = "CRIAR CONTA";
    }
});

$("btn-sair")?.addEventListener("click", async () => {
    try {
        await signOut(auth);
        window.location.reload();
    } catch (error) {
        console.error(error);
        alert("Não foi possível sair da conta: " + error.message);
    }
});

// ======================================================
// AUTENTICAÇÃO E INICIALIZAÇÃO
// ======================================================

onAuthStateChanged(auth, async (user) => {
    usuarioAtual = user;

    if (!user) {
        if (telaLogin) telaLogin.classList.remove("hidden");
        if (sitePrincipal) sitePrincipal.classList.add("hidden");
        return;
    }

    if (telaLogin) telaLogin.classList.add("hidden");
    if (sitePrincipal) sitePrincipal.classList.remove("hidden");

    const parametros = new URLSearchParams(window.location.search);
    const fichaSolicitada = parametros.get("ficha");

    fichaAtualId = fichaSolicitada || user.uid;

    const btnMestre = $("btn-painel-mestre");

    if (btnMestre) {
        btnMestre.style.display = ehMestre() ? "block" : "none";
        btnMestre.classList.toggle("hidden", !ehMestre());
    }

    try {
        await carregarFicha();
    } catch (error) {
        console.error("Falha ao carregar ficha:", error);
        alert(
            `Erro ao carregar ficha (${error.code || "desconhecido"}): ${error.message}`
        );
    }
});

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
                const proporcao = Math.min(
                    limite / largura,
                    limite / altura
                );

                largura = Math.round(largura * proporcao);
                altura = Math.round(altura * proporcao);
            }

            const canvas = document.createElement("canvas");
            canvas.width = largura;
            canvas.height = altura;

            const contexto = canvas.getContext("2d");

            if (!contexto) {
                reject(new Error("Não foi possível processar a imagem."));
                return;
            }

            contexto.drawImage(imagem, 0, 0, largura, altura);

            try {
                resolve(canvas.toDataURL("image/webp", 0.78));
            } catch (error) {
                reject(error);
            }
        };

        imagem.onerror = () => {
            reject(new Error("Não foi possível abrir esta imagem."));
        };

        imagem.src = dataUrl;
    });
}

window.abrirSeletor = function(callback) {
    const input = document.createElement("input");

    input.type = "file";
    input.accept = "image/*";

    input.onchange = async (evento) => {
        const arquivo = evento.target.files?.[0];

        if (!arquivo) return;

        if (!arquivo.type.startsWith("image/")) {
            alert("Selecione um arquivo de imagem.");
            return;
        }

        try {
            const leitor = new FileReader();

            leitor.onload = async (e) => {
                try {
                    const imagem = await comprimirImagem(e.target.result);
                    callback(imagem);
                } catch (error) {
                    console.error(error);
                    alert("Não foi possível preparar a imagem.");
                }
            };

            leitor.onerror = () => {
                alert("Erro ao ler o arquivo de imagem.");
            };

            leitor.readAsDataURL(arquivo);
        } catch (error) {
            console.error(error);
            alert("Erro ao abrir a imagem.");
        }
    };

    input.click();
};

window.uploadFoto = function(elemento) {
    window.abrirSeletor((imagem) => {
        elemento.innerHTML = `
            <img src="${imagem}"
                style="width:100%;height:100%;object-fit:cover;object-position:top center;position:absolute;top:0;left:0;z-index:1;pointer-events:none;">
        `;

        elemento.onclick = null;

        const botao = document.createElement("button");
        botao.type = "button";
        botao.textContent = "X";
        botao.className =
            "absolute top-2 right-2 bg-red-800 text-white rounded-full w-6 h-6 flex items-center justify-center cursor-pointer z-20 text-sm font-bold shadow-lg";

        botao.onclick = (evento) => {
            evento.stopPropagation();

            elemento.innerHTML = `
                <i class="fa-solid fa-camera text-4xl text-black/20 mb-2"></i>
                <span>FOTO DO<br>PERSONAGEM</span>
                <div class="texto-proporcao">PROPORÇÃO IDEAL: 9x16</div>
            `;

            elemento.onclick = () => window.uploadFoto(elemento);
        };

        elemento.appendChild(botao);
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

    document.querySelectorAll(".item-adicionado").forEach((item) => {
        const quantidade = Number(item.dataset.qtd) || 1;
        const peso = Number(
            (item.dataset.peso || "0").toString().replace(",", ".")
        ) || 0;

        pesoTotal += quantidade * peso;
    });

    if (pesoEl) pesoEl.textContent = pesoTotal.toFixed(2);

    if (espacosEl) {
        espacosEl.textContent =
            document.querySelectorAll("#inventario .item-adicionado").length;
    }
}

const modalHTML = `
<div id="modal-item"
    class="fixed inset-0 bg-black/80 z-50 flex justify-center items-center hidden">
    <div class="painel-papel p-6 rounded-lg w-[400px] max-w-[95vw] flex flex-col gap-3 relative">
        <h3 class="fonte-titulo text-2xl text-[#111] border-b border-black/30 pb-2 mb-2">
            DADOS DO ITEM
        </h3>

        <div class="flex gap-4">
            <div id="modal-preview"
                class="w-24 h-24 rounded flex flex-col justify-center items-center relative overflow-hidden text-black/30 border-2 border-dashed border-[#3a2e27] bg-black/10">
                <i class="fa-solid fa-camera text-2xl mb-1"></i>
                <span class="text-[9px] font-bold text-center leading-tight">SEM IMAGEM</span>
            </div>

            <div class="flex-1 flex flex-col gap-2">
                <label class="flex flex-col text-sm font-bold text-[#111]">
                    Nome do Item:
                    <input type="text" id="modal-nome" class="input-campo p-2">
                </label>

                <button type="button" id="btn-upload"
                    class="bg-[#3a2e27] text-white p-2 rounded font-bold hover:bg-[#a81c1c] transition text-sm">
                    Escolher Imagem
                </button>
            </div>
        </div>

        <div class="flex gap-2">
            <label class="flex flex-col text-sm font-bold text-[#111] flex-1">
                Quantidade:
                <input type="number" id="modal-qtd" value="1" min="1" class="input-campo p-2">
            </label>

            <label class="flex flex-col text-sm font-bold text-[#111] flex-1">
                Peso Unit. (kg):
                <input type="text" id="modal-peso" class="input-campo p-2" placeholder="Ex: 0.5">
            </label>
        </div>

        <label class="flex flex-col text-sm font-bold text-[#111]">
            Descrição:
            <textarea id="modal-desc" class="input-campo p-2 resize-none h-16"></textarea>
        </label>

        <div class="flex justify-between mt-2 gap-2">
            <button type="button" id="btn-excluir"
                class="bg-gray-600 text-white p-2 rounded font-bold flex-1 hidden">
                Excluir
            </button>

            <button type="button" id="btn-cancelar"
                class="bg-gray-600 text-white p-2 rounded font-bold flex-1">
                Cancelar
            </button>

            <button type="button" id="btn-salvar-item"
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

            <button type="button" id="btn-remover-img-modal"
                class="absolute top-1 right-1 bg-red-800 text-white rounded-full w-5 h-5 flex items-center justify-center cursor-pointer z-20 text-[10px] font-bold">
                X
            </button>
        `;

        modalPreview.classList.remove("border-dashed");
        modalPreview.classList.add("border-solid");

        $("btn-remover-img-modal").onclick = (evento) => {
            evento.preventDefault();
            imagemAtualBase64 = null;
            atualizarPreviewModal();
        };
    } else {
        modalPreview.innerHTML = `
            <i class="fa-solid fa-camera text-2xl mb-1"></i>
            <span class="text-[9px] font-bold text-center leading-tight">SEM IMAGEM</span>
        `;

        modalPreview.classList.add("border-dashed");
        modalPreview.classList.remove("border-solid");
    }
}

function abrirModal(quadrado, dados = null) {
    quadradoAtual = quadrado;

    if (dados) {
        inputNome.value = dados.nome || "";
        inputQtd.value = dados.qtd || 1;
        inputPeso.value = dados.peso || "";
        inputDesc.value = dados.desc || "";

        imagemAtualBase64 = dados.img || null;

        btnExcluir.classList.remove("hidden");
        $("modal-item").querySelector("h3").textContent = "EDITAR ITEM";
        btnSalvarItem.textContent = "SALVAR";
    } else {
        inputNome.value = "";
        inputQtd.value = 1;
        inputPeso.value = "";
        inputDesc.value = "";

        imagemAtualBase64 = null;

        btnExcluir.classList.add("hidden");
        $("modal-item").querySelector("h3").textContent = "NOVO ITEM";
        btnSalvarItem.textContent = "ADICIONAR";
    }

    atualizarPreviewModal();
    modal.classList.remove("hidden");
}

btnCancelar.onclick = () => modal.classList.add("hidden");

btnUpload.onclick = () => {
    window.abrirSeletor((imagem) => {
        imagemAtualBase64 = imagem;
        atualizarPreviewModal();
    });
};

btnExcluir.onclick = () => {
    if (!quadradoAtual) return;

    if (quadradoAtual.id.startsWith("inv-")) {
        quadradoAtual.innerHTML =
            '<span class="text-2xl text-black/20 group-hover:text-red-800 transition-colors">+</span>';
    } else {
        quadradoAtual.innerHTML =
            quadradoAtual.getAttribute("data-original") +
            '<span class="text-lg text-black/30"><i class="fa-solid fa-upload"></i></span>';
    }

    quadradoAtual.classList.remove("item-adicionado");
    quadradoAtual.removeAttribute("data-itemData");
    quadradoAtual.removeAttribute("data-peso");
    quadradoAtual.removeAttribute("data-qtd");

    recalcularPesoTotal();
    modal.classList.add("hidden");
};

btnSalvarItem.onclick = () => {
    const nome = inputNome.value.trim();
    const pesoString = inputPeso.value.trim().replace(",", ".");
    const quantidade = parseInt(inputQtd.value, 10) || 0;

    if (!imagemAtualBase64) {
        alert("Escolha uma imagem.");
        return;
    }

    if (!nome) {
        alert("Digite o nome do item.");
        return;
    }

    if (quantidade <= 0) {
        alert("A quantidade precisa ser maior que zero.");
        return;
    }

    if (pesoString === "" || !Number.isFinite(Number(pesoString)) || Number(pesoString) < 0) {
        alert("Informe um peso válido.");
        return;
    }

    const dados = {
        img: imagemAtualBase64,
        nome,
        qtd: quantidade,
        peso: pesoString,
        desc: inputDesc.value
    };

    renderizarItem(quadradoAtual, dados);
    recalcularPesoTotal();
    modal.classList.add("hidden");
};

function renderizarItem(quadrado, dados) {
    const equipamento = !quadrado.id.startsWith("inv-");

    const classeTexto = equipamento
        ? "opacity-0 group-hover:opacity-100 transition-opacity"
        : "opacity-100";

    // O texto é inserido como texto, evitando interpretar nomes como HTML.
    quadrado.innerHTML = "";

    if (dados.img) {
        const imagem = document.createElement("img");
        imagem.src = dados.img;
        imagem.style.cssText =
            "width:100%;height:100%;object-fit:contain;position:absolute;top:0;left:0;padding:4px;z-index:1;";
        quadrado.appendChild(imagem);
    }

    const identificacao = document.createElement("div");
    identificacao.className =
        `text-[10px] font-bold bg-black/40 text-white px-1 rounded leading-tight w-full absolute bottom-0 left-0 z-10 text-center ${classeTexto}`;

    const nome = document.createElement("span");
    nome.textContent = dados.nome;

    const detalhes = document.createElement("span");
    detalhes.textContent =
        `Qtd: ${dados.qtd} | ${dados.peso}kg`;

    identificacao.append(nome, document.createElement("br"), detalhes);
    quadrado.appendChild(identificacao);

    const editar = document.createElement("div");
    editar.className =
        "absolute inset-0 bg-black/80 text-white text-[10px] p-1 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center pointer-events-none z-20";

    const titulo = document.createElement("span");
    titulo.className = "font-bold mb-1";
    titulo.textContent = "EDITAR";

    editar.appendChild(titulo);

    if (dados.desc) {
        const descricao = document.createElement("span");
        descricao.className = "italic text-gray-300 truncate w-full text-center";
        descricao.textContent = dados.desc;
        editar.appendChild(descricao);
    }

    quadrado.appendChild(editar);

    quadrado.classList.add("item-adicionado");
    quadrado.dataset.itemData = JSON.stringify(dados);
    quadrado.dataset.peso = dados.peso;
    quadrado.dataset.qtd = dados.qtd;
}

if (gridInv) {
    for (let i = 0; i < 16; i++) {
        const quadrado = document.createElement("div");

        quadrado.id = `inv-${i}`;
        quadrado.className =
            "slot-vazio rounded aspect-square flex flex-col justify-center items-center relative text-center p-1 overflow-hidden group";

        quadrado.innerHTML =
            '<span class="text-2xl text-black/20 group-hover:text-red-800 transition-colors">+</span>';

        quadrado.onclick = () => {
            if (quadrado.classList.contains("item-adicionado")) {
                abrirModal(quadrado, JSON.parse(quadrado.dataset.itemData));
            } else {
                abrirModal(quadrado);
            }
        };

        gridInv.appendChild(quadrado);
    }
}

const slotsEquipamento = document.querySelectorAll(
    ".slot-vazio:not(#inventario .slot-vazio)"
);

slotsEquipamento.forEach((slot) => {
    if (slot.classList.contains("foto-personagem")) return;

    slot.setAttribute("data-original", slot.innerHTML.split("<span")[0]);
    slot.removeAttribute("onclick");

    slot.onclick = () => {
        if (slot.classList.contains("item-adicionado")) {
            abrirModal(slot, JSON.parse(slot.dataset.itemData));
        } else {
            abrirModal(slot);
        }
    };
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

        const numero = document.createElement("span");
        numero.className =
            "font-bold w-5 text-right text-[#111] text-sm";
        numero.textContent = `${i}.`;

        const campo = document.createElement("input");
        campo.type = "text";
        campo.className =
            "bg-transparent border-none outline-none font-semibold text-[#111] text-base w-full";

        linha.append(numero, campo);
        listaT.appendChild(linha);
    }
}

// ======================================================
// IMAGENS NO FIRESTORE
// ======================================================

function imagemEhBase64(valor) {
    return typeof valor === "string" &&
        valor.startsWith("data:image/");
}

async function salvarImagemSeparada(idImagem, imagem) {
    if (!imagem) return;

    await setDoc(
        doc(db, "fichas", fichaAtualId, "imagens", idImagem),
        { imagem }
    );
}

async function carregarImagensSeparadas() {
    const snapshot = await getDocs(
        collection(db, "fichas", fichaAtualId, "imagens")
    );

    const imagens = {};

    snapshot.forEach((documento) => {
        imagens[documento.id] = documento.data().imagem || "";
    });

    return imagens;
}

// ======================================================
// SALVAR FICHA
// ======================================================

$("btn-salvar-ficha")?.addEventListener("click", async () => {
    if (!usuarioAtual || !fichaAtualId) {
        alert("Você precisa estar conectado para salvar.");
        return;
    }

    const botaoSalvar = $("btn-salvar-ficha");
    const textoOriginal = botaoSalvar.textContent;

    botaoSalvar.disabled = true;
    botaoSalvar.textContent = "SALVANDO...";

    try {
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
            ).map((campo) => campo.value),

            fotoPersonagem: "",
            itensMochila: [],
            itensEquipamento: []
        };

        // Metadados administrativos somente são gravados pelo mestre.
        if (ehMestre()) {
            dadosFicha.tipo = fichaAtualTipo;
            dadosFicha.proprietarioUid = fichaAtualProprietarioUid || null;
            dadosFicha.criadoPor = fichaAtualCriadoPor || usuarioAtual.uid;
        }

        const imagensAtivas = {};

        // FOTO DO PERSONAGEM
        const fotoContainer = $("foto-personagem");
        const imagemRetrato = fotoContainer?.querySelector("img");

        if (imagemRetrato) {
            const foto = imagemRetrato.getAttribute("src");

            if (foto) {
                imagensAtivas.personagem = foto;
            }

            dadosFicha.fotoPersonagem =
                fotoContainer.innerHTML.replace(
                    foto || "",
                    "__IMAGEM_PERSONAGEM__"
                );
        } else if (fotoContainer) {
            dadosFicha.fotoPersonagem = fotoContainer.innerHTML;
        }

        // ITENS DA MOCHILA
        document.querySelectorAll(
            "#inventario .item-adicionado"
        ).forEach((elemento) => {
            const dados = JSON.parse(elemento.dataset.itemData);
            const imagemId = `mochila_${elemento.id}`;

            if (dados.img) {
                imagensAtivas[imagemId] = dados.img;
            }

            dadosFicha.itensMochila.push({
                dados: {
                    nome: dados.nome,
                    qtd: dados.qtd,
                    peso: dados.peso,
                    desc: dados.desc || "",
                    img: ""
                },
                imagemId,
                posicao: elemento.id
            });
        });

        // EQUIPAMENTOS
        const todosSlots = Array.from(
            document.querySelectorAll(".slot-vazio")
        );

        document.querySelectorAll(
            ".slot-vazio.item-adicionado"
        ).forEach((elemento) => {
            const dados = JSON.parse(elemento.dataset.itemData);
            const indice = todosSlots.indexOf(elemento);
            const imagemId = `equipamento_${indice}`;

            if (dados.img) {
                imagensAtivas[imagemId] = dados.img;
            }

            dadosFicha.itensEquipamento.push({
                dados: {
                    nome: dados.nome,
                    qtd: dados.qtd,
                    peso: dados.peso,
                    desc: dados.desc || "",
                    img: ""
                },
                imagemId,
                posicao: elemento.getAttribute("data-original")
            });
        });

        // PRIMEIRO CRIA/ATUALIZA A FICHA PRINCIPAL.
        // Isso permite que as regras do Firestore reconheçam
        // o proprietário antes de gravar imagens na subcoleção.
        await setDoc(
            doc(db, "fichas", fichaAtualId),
            dadosFicha,
            { merge: true }
        );

        // DEPOIS SALVA AS IMAGENS.
        for (const [idImagem, imagem] of Object.entries(imagensAtivas)) {
            await salvarImagemSeparada(idImagem, imagem);
        }

        // REMOVE IMAGENS ANTIGAS QUE NÃO ESTÃO MAIS EM USO.
        const imagensAntigas = await getDocs(
            collection(db, "fichas", fichaAtualId, "imagens")
        );

        for (const documento of imagensAntigas.docs) {
            if (!imagensAtivas[documento.id]) {
                await deleteDoc(documento.ref);
            }
        }

        alert("Ficha salva com sucesso!");

    } catch (error) {
        console.error("Falha ao salvar ficha:", error);

        alert(
            `Erro ao salvar ficha (${error.code || "desconhecido"}): ${error.message}`
        );

    } finally {
        botaoSalvar.disabled = false;
        botaoSalvar.textContent = textoOriginal;
    }
});

// ======================================================
// CARREGAR FICHA
// ======================================================

async function carregarFicha() {
    if (!usuarioAtual || !fichaAtualId) return;

    let documento = await getDoc(
        doc(db, "fichas", fichaAtualId)
    );

    if (!documento.exists() && fichaAtualId === usuarioAtual.uid) {
        const vinculadas = await getDocs(
            query(
                collection(db, "fichas"),
                where("proprietarioUid", "==", usuarioAtual.uid),
                limit(1)
            )
        );

        if (!vinculadas.empty) {
            documento = vinculadas.docs[0];
            fichaAtualId = documento.id;
        }
    }

    if (!documento.exists()) {
        if (fichaAtualId !== usuarioAtual.uid) {
            alert("Esta ficha não foi encontrada ou você não tem acesso a ela.");
            window.location.href = window.location.pathname;
        }

        return;
    }

    const dados = documento.data();

    if (
        !ehMestre() &&
        fichaAtualId !== usuarioAtual.uid &&
        dados.proprietarioUid !== usuarioAtual.uid
    ) {
        alert("Você não tem permissão para abrir esta ficha.");
        window.location.href = window.location.pathname;
        return;
    }

    fichaAtualTipo = dados.tipo || "jogador";

    fichaAtualProprietarioUid =
        dados.proprietarioUid ||
        (fichaAtualTipo === "jogador" ? fichaAtualId : null);

    fichaAtualCriadoPor =
        dados.criadoPor ||
        fichaAtualProprietarioUid ||
        usuarioAtual.uid;

    const imagensSeparadas = await carregarImagensSeparadas();

    $("nome").value = dados.nome || "";
    $("idade").value = dados.idade || "";
    $("nivel").value = dados.nivel || "";
    $("exp").value = dados.exp || "";

    forca.value = dados.forca || "";
    destreza.value = dados.destreza || "";

    calcular();

    $("constituicao").value = dados.constituicao || "";
    $("inteligencia").value = dados.inteligencia || "";
    $("percepcao").value = dados.percepcao || "";
    $("vontade").value = dados.vontade || "";
    $("carisma").value = dados.carisma || "";
    $("esquiva").value = dados.esquiva || "";
    $("movimentacao").value = dados.movimentacao || 6;
    $("diario").value = dados.diario || "";

    const camposTalentos = document.querySelectorAll("#talentos input");

    camposTalentos.forEach((campo, indice) => {
        campo.value = (dados.talentos || [])[indice] || "";
    });

    // FOTO DO PERSONAGEM
    const fotoContainer = $("foto-personagem");

    if (dados.fotoPersonagem && dados.fotoPersonagem.includes("img")) {
        let fotoHTML = dados.fotoPersonagem;

        if (imagensSeparadas.personagem) {
            fotoHTML = fotoHTML.replace(
                "__IMAGEM_PERSONAGEM__",
                imagensSeparadas.personagem
            );
        }

        fotoContainer.innerHTML = fotoHTML;

        const imagem = fotoContainer.querySelector("img");

        if (imagem) {
            fotoContainer.onclick = null;
        }
    }

    // LIMPA OS ITENS VISUAIS ANTES DE RECARREGAR.
    document.querySelectorAll(".item-adicionado").forEach((elemento) => {
        elemento.classList.remove("item-adicionado");
        elemento.removeAttribute("data-itemData");
        elemento.removeAttribute("data-peso");
        elemento.removeAttribute("data-qtd");
    });

    // MOCHILA
    (dados.itensMochila || []).forEach((item) => {
        const elemento = $(item.posicao);

        if (!elemento) return;

        const dadosItem = { ...item.dados };

        if (item.imagemId && imagensSeparadas[item.imagemId]) {
            dadosItem.img = imagensSeparadas[item.imagemId];
        }

        renderizarItem(elemento, dadosItem);
    });

    // EQUIPAMENTOS
    (dados.itensEquipamento || []).forEach((item) => {
        const elemento = Array.from(
            document.querySelectorAll(".slot-vazio")
        ).find(
            (slot) =>
                slot.getAttribute("data-original") === item.posicao
        );

        if (!elemento) return;

        const dadosItem = { ...item.dados };

        if (item.imagemId && imagensSeparadas[item.imagemId]) {
            dadosItem.img = imagensSeparadas[item.imagemId];
        }

        renderizarItem(elemento, dadosItem);
    });

    recalcularPesoTotal();
}

// ======================================================
// PAINEL DO MESTRE
// ======================================================

function abrirFichaEmNovaAba(idFicha) {
    const url = new URL(window.location.href);

    url.searchParams.set("ficha", idFicha);

    window.open(url.toString(), "_blank");
}

function criarBotaoPainel(texto, classe, acao) {
    const botao = document.createElement("button");

    botao.type = "button";
    botao.textContent = texto;
    botao.className =
        `px-2 py-1 rounded text-xs font-bold text-white ${classe}`;

    botao.addEventListener("click", acao);

    return botao;
}

async function atualizarPainelMestre() {
    const lista = $("lista-jogadores");

    if (!lista || !ehMestre()) return;

    lista.textContent = "Buscando fichas...";

    try {
        const snapshot = await getDocs(
            collection(db, "fichas")
        );

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

        fichasOrdenadas.forEach((documento) => {
            const ficha = documento.data();
            const idFicha = documento.id;
            const tipo = ficha.tipo || "jogador";

            const proprietario =
                ficha.proprietarioNome ||
                ficha.proprietarioEmail ||
                (
                    ficha.proprietarioUid
                        ? `Conta vinculada (${ficha.proprietarioUid.slice(0, 8)}...)`
                        : (
                            tipo === "jogador"
                                ? `Conta antiga (${idFicha.slice(0, 8)}...)`
                                : "Sem proprietário"
                        )
                );

            const linha = document.createElement("div");

            linha.className =
                "border-b border-black/20 p-3 mb-2 flex flex-col gap-2 bg-white/30 rounded";

            const topo = document.createElement("div");

            topo.className =
                "flex flex-wrap justify-between gap-2 items-start";

            const info = document.createElement("div");
            info.className = "min-w-0";

            const nome = document.createElement("strong");
            nome.className = "text-lg";
            nome.textContent = ficha.nome || "Sem nome";

            const detalhes = document.createElement("div");
            detalhes.className = "text-sm";

            detalhes.textContent =
                `${tipo === "pdm" ? "PDM" : "Jogador"} | Nível ${ficha.nivel || 1} | Força ${ficha.forca || "-"} (${ficha.forcaAcao || 0}%)`;

            const dono = document.createElement("div");
            dono.className = "text-xs opacity-80";
            dono.textContent = `Proprietário: ${proprietario}`;

            info.append(nome, detalhes, dono);

            const abrir = criarBotaoPainel(
                "ABRIR",
                "bg-[#3a2e27]",
                () => abrirFichaEmNovaAba(idFicha)
            );

            topo.append(info, abrir);

            const acoes = document.createElement("div");
            acoes.className = "flex flex-wrap gap-2";

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
                    "EXCLUIR",
                    "bg-red-800",
                    () => excluirFicha(idFicha, ficha)
                )
            );

            linha.append(topo, acoes);
            lista.appendChild(linha);
        });

    } catch (error) {
        console.error("Falha ao listar fichas:", error);

        lista.textContent =
            `Erro ao carregar as fichas (${error.code || "desconhecido"}): ${error.message}`;
    }
}

// ======================================================
// CRIAR PDM
// ======================================================

async function criarPDM() {
    if (!usuarioAtual || !ehMestre()) return;

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
    )) {
        return;
    }

    try {
        const imagens = await getDocs(
            collection(db, "fichas", idFicha, "imagens")
        );

        const lote = writeBatch(db);

        imagens.forEach((item) => {
            lote.delete(item.ref);
        });

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

            nome: novoNome.trim() ||
                `${ficha.nome || "Personagem"} (Cópia)`,

            tipo: "pdm",
            proprietarioUid: null,
            proprietarioNome: "",
            proprietarioEmail: "",
            criadoPor: usuarioAtual.uid
        };

        await setDoc(novaRef, copia);

        if (!imagensOrigem.empty) {
            const lote = writeBatch(db);

            imagensOrigem.forEach((item) => {
                lote.set(
                    doc(
                        db,
                        "fichas",
                        novaRef.id,
                        "imagens",
                        item.id
                    ),
                    item.data()
                );
            });

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
        alert("O UID não pode ficar vazio.");
        return;
    }

    if (uidLimpo.length < 10) {
        alert("Esse UID parece incompleto.");
        return;
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

        alert("Vínculo registrado com sucesso.");

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
        alert("Esta ficha não possui jogador vinculado.");
        return;
    }

    if (!confirm(
        `Desvincular o jogador desta ficha (${ficha.nome || "Sem nome"})?`
    )) {
        return;
    }

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

        alert("Jogador desvinculado. A ficha agora é independente.");

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
        if (!ehMestre()) return;

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

// ======================================================
// FIM DO SCRIPT
// ======================================================

console.log("Sistema de fichas carregado corretamente.");
