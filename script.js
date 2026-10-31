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
    getDocs
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

let usuarioAtual = null;
const emailMestre = "rpggrupoc5@gmail.com";

// ======================================================
// ELEMENTOS E ATRIBUTOS
// ======================================================
const $ = (id) => document.getElementById(id);

const forca = $("forca");
const destreza = $("destreza");
const forcaAcao = $("forca-acao");
const destrezaAcao = $("destreza-acao");

function calcular() {
    if (forca && forcaAcao) {
        forcaAcao.value = forca.value === "" ? "" : Number(forca.value) * 3;
    }
    if (destreza && destrezaAcao) {
        destrezaAcao.value = destreza.value === "" ? "" : Number(destreza.value) * 3;
    }
}

forca?.addEventListener("input", calcular);
destreza?.addEventListener("input", calcular);

// ======================================================
// LOGIN
// ======================================================
const telaLogin = $("tela-login");
const sitePrincipal = $("site-principal");
const mensagemErro = $("mensagem-erro");

$("btn-entrar")?.addEventListener("click", async () => {
    const email = $("login-email")?.value.trim();
    const senha = $("login-senha")?.value;

    try {
        await signInWithEmailAndPassword(auth, email, senha);
        mensagemErro?.classList.add("hidden");
    } catch (error) {
        console.error("Falha no login:", error);
        if (mensagemErro) {
            mensagemErro.textContent = `Erro no login (${error.code || "desconhecido"}): ${error.message}`;
            mensagemErro.classList.remove("hidden");
        }
    }
});

$("btn-cadastrar")?.addEventListener("click", async () => {
    const email = $("login-email")?.value.trim();
    const senha = $("login-senha")?.value;

    try {
        await createUserWithEmailAndPassword(auth, email, senha);
        alert("Conta criada! Bem-vindo.");
    } catch (error) {
        console.error("Falha no cadastro:", error);
        if (mensagemErro) {
            mensagemErro.textContent = `Erro no cadastro (${error.code || "desconhecido"}): ${error.message}`;
            mensagemErro.classList.remove("hidden");
        }
    }
});

$("btn-sair")?.addEventListener("click", () => {
    signOut(auth).then(() => window.location.reload());
});

// ======================================================
// AUTENTICAÇÃO E CARREGAMENTO
// ======================================================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        usuarioAtual = null;
        telaLogin?.classList.remove("hidden");
        sitePrincipal?.classList.add("hidden");
        return;
    }

    usuarioAtual = user;
    telaLogin?.classList.add("hidden");
    sitePrincipal?.classList.remove("hidden");

    const ehMestre = (user.email || "").trim().toLowerCase() === emailMestre.toLowerCase();
    const btnMestre = $("btn-painel-mestre");

    if (btnMestre) {
        btnMestre.classList.toggle("hidden", !ehMestre);
        btnMestre.style.display = ehMestre ? "block" : "none";
    }

    try {
        await carregarFicha();
    } catch (error) {
        console.error("Falha ao carregar ficha:", error);
        alert(`Erro ao carregar ficha (${error.code || "desconhecido"}): ${error.message}`);
    }
});

// ======================================================
// SELEÇÃO E UPLOAD DE IMAGENS
// ======================================================
window.abrirSeletor = function(callback) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = (event) => {
        const arquivo = event.target.files?.[0];
        if (!arquivo) return;

        const leitor = new FileReader();
        leitor.onload = (eventoLeitura) => callback(eventoLeitura.target.result);
        leitor.onerror = () => alert("Não foi possível ler a imagem selecionada.");
        leitor.readAsDataURL(arquivo);
    };

    input.click();
};

window.uploadFoto = function(elemento) {
    window.abrirSeletor((imagemBase64) => {
        elemento.innerHTML = `
            <img src="${imagemBase64}" style="width:100%;height:100%;object-fit:cover;object-position:top center;position:absolute;top:0;left:0;z-index:1;pointer-events:none;">
            <button type="button" aria-label="Remover foto" class="absolute top-2 right-2 bg-red-800 text-white rounded-full w-6 h-6 flex items-center justify-center cursor-pointer z-20 text-sm font-bold shadow-lg">X</button>
        `;

        const botaoRemover = elemento.querySelector("button");
        botaoRemover.onclick = (event) => {
            event.stopPropagation();
            elemento.innerHTML = `
                <i class="fa-solid fa-camera text-4xl text-black/20 mb-2"></i>
                <span class="z-10">FOTO DO<br>PERSONAGEM</span>
                <div class="texto-proporcao z-10">PROPORÇÃO 9x16</div>
            `;
            elemento.onclick = () => window.uploadFoto(elemento);
        };

        elemento.onclick = null;
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
        const quantidade = Number.parseFloat(item.dataset.qtd) || 1;
        const peso = Number.parseFloat(String(item.dataset.peso || "0").replace(",", ".")) || 0;
        pesoTotal += quantidade * peso;
    });

    if (pesoEl) pesoEl.textContent = pesoTotal.toFixed(2);
    if (espacosEl) {
        espacosEl.textContent = document.querySelectorAll("#inventario .item-adicionado").length;
    }
}

const modalHTML = `
<div id="modal-item" class="fixed inset-0 bg-black/80 z-50 flex justify-center items-center hidden">
    <div class="painel-papel p-6 rounded-lg w-[400px] max-w-[95vw] flex flex-col gap-3 relative">
        <h3 class="fonte-titulo text-2xl text-[#111] border-b border-black/30 pb-2 mb-2">DADOS DO ITEM</h3>
        <div class="flex gap-4">
            <div id="modal-preview" class="w-24 h-24 rounded flex flex-col justify-center items-center relative overflow-hidden text-black/30 border-2 border-dashed border-[#3a2e27] bg-black/10">
                <i class="fa-solid fa-camera text-2xl mb-1"></i>
                <span class="text-[9px] font-bold text-center leading-tight">SEM IMAGEM</span>
            </div>
            <div class="flex-1 flex flex-col gap-2">
                <label class="flex flex-col text-sm font-bold text-[#111]">Nome do Item: <input type="text" id="modal-nome" class="input-campo p-2"></label>
                <button type="button" id="btn-upload" class="bg-[#3a2e27] text-white p-2 rounded font-bold hover:bg-[#a81c1c] transition text-sm"><i class="fa-solid fa-camera"></i> Escolher Imagem</button>
            </div>
        </div>
        <div class="flex gap-2">
            <label class="flex flex-col text-sm font-bold text-[#111] flex-1">Quantidade: <input type="number" id="modal-qtd" min="1" value="1" class="input-campo p-2"></label>
            <label class="flex flex-col text-sm font-bold text-[#111] flex-1">Peso Unit. (kg): <input type="text" id="modal-peso" class="input-campo p-2" placeholder="Ex: 0.5"></label>
        </div>
        <label class="flex flex-col text-sm font-bold text-[#111]">Descrição: <textarea id="modal-desc" class="input-campo p-2 resize-none h-16"></textarea></label>
        <div class="flex justify-between mt-2 gap-2">
            <button type="button" id="btn-excluir" class="bg-gray-600 text-white p-2 rounded font-bold flex-1 hover:bg-gray-700 hidden">Excluir</button>
            <button type="button" id="btn-cancelar" class="bg-gray-600 text-white p-2 rounded font-bold flex-1 hover:bg-gray-700">Cancelar</button>
            <button type="button" id="btn-salvar-item" class="bg-[#a81c1c] text-white p-2 rounded font-bold flex-1 hover:brightness-125">Salvar</button>
        </div>
    </div>
</div>`;

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
            <img src="${imagemAtualBase64}" style="width:100%;height:100%;object-fit:contain;padding:4px;">
            <button type="button" id="btn-remover-img-modal" class="absolute top-1 right-1 bg-red-800 text-white rounded-full w-5 h-5 flex items-center justify-center cursor-pointer z-20 text-[10px] font-bold">X</button>
        `;
        modalPreview.classList.remove("border-dashed");
        modalPreview.classList.add("border-solid");

        $("btn-remover-img-modal").onclick = (event) => {
            event.preventDefault();
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

    if (dados?.nome) {
        inputNome.value = dados.nome || "";
        inputQtd.value = dados.qtd ?? 1;
        inputPeso.value = dados.peso ?? "";
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

function limparItemDoSlot(slot) {
    if (slot.id.startsWith("inv-")) {
        slot.innerHTML = '<span class="text-2xl text-black/20 group-hover:text-red-800 transition-colors">+</span>';
    } else {
        slot.innerHTML = (slot.dataset.original || "") + '<span class="text-lg text-black/30"><i class="fa-solid fa-upload"></i></span>';
    }

    slot.classList.remove("item-adicionado");
    delete slot.dataset.itemData;
    delete slot.dataset.peso;
    delete slot.dataset.qtd;
}

btnExcluir.onclick = () => {
    if (!quadradoAtual) return;
    limparItemDoSlot(quadradoAtual);
    recalcularPesoTotal();
    modal.classList.add("hidden");
};

btnSalvarItem.onclick = () => {
    if (!quadradoAtual) return;

    const nome = inputNome.value.trim();
    const quantidade = Number.parseInt(inputQtd.value, 10);
    const pesoTexto = inputPeso.value.trim().replace(",", ".");
    const pesoNumero = Number.parseFloat(pesoTexto);

    if (!imagemAtualBase64) return alert("Escolha uma imagem.");
    if (!nome) return alert("Digite o nome do item.");
    if (!Number.isInteger(quantidade) || quantidade <= 0) return alert("A quantidade deve ser maior que zero.");
    if (pesoTexto === "" || !Number.isFinite(pesoNumero) || pesoNumero < 0) {
        return alert("Digite um peso válido, igual ou maior que zero.");
    }

    const dados = {
        img: imagemAtualBase64,
        nome,
        qtd: quantidade,
        peso: pesoTexto,
        desc: inputDesc.value || ""
    };

    renderizarItem(quadradoAtual, dados);
    recalcularPesoTotal();
    modal.classList.add("hidden");
};

function renderizarItem(slot, dados) {
    const ehEquipamento = !slot.id.startsWith("inv-");
    const classeTexto = ehEquipamento
        ? "opacity-0 group-hover:opacity-100 transition-opacity"
        : "opacity-100";

    // Escapa texto digitado para evitar que nomes/descrições sejam interpretados como HTML.
    const escaparHTML = (valor) => String(valor ?? "").replace(/[&<>"']/g, (caractere) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[caractere]);

    slot.innerHTML = `
        ${dados.img ? `<img src="${dados.img}" style="width:100%;height:100%;object-fit:contain;position:absolute;top:0;left:0;padding:4px;z-index:1;">` : ""}
        <div class="text-[10px] font-bold bg-black/40 text-white px-1 rounded leading-tight w-full absolute bottom-0 left-0 z-10 text-center ${classeTexto}">
            ${escaparHTML(dados.nome)} <br>
            <span class="text-gray-300">Qtd: ${escaparHTML(dados.qtd)}</span> |
            <span class="text-gray-300">${escaparHTML(dados.peso)}kg</span>
        </div>
        <div class="absolute inset-0 bg-black/80 text-white text-[10px] p-1 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center pointer-events-none z-20">
            <span class="font-bold mb-1">EDITAR</span>
            ${dados.desc ? `<span class="italic text-gray-300 truncate w-full text-center">"${escaparHTML(dados.desc)}"</span>` : ""}
        </div>
    `;

    slot.classList.add("item-adicionado");
    slot.dataset.itemData = JSON.stringify(dados);
    slot.dataset.peso = String(dados.peso);
    slot.dataset.qtd = String(dados.qtd);
}

// Cria os 16 espaços, sem alterar a estrutura visual definida no HTML.
if (gridInv) {
    for (let i = 0; i < 16; i++) {
        const slot = document.createElement("div");
        slot.id = `inv-${i}`;
        slot.className = "slot-vazio rounded aspect-square flex flex-col justify-center items-center relative text-center p-1 overflow-hidden group";
        slot.innerHTML = '<span class="text-2xl text-black/20 group-hover:text-red-800 transition-colors">+</span>';

        slot.onclick = () => {
            if (slot.classList.contains("item-adicionado")) {
                abrirModal(slot, JSON.parse(slot.dataset.itemData));
            } else {
                abrirModal(slot);
            }
        };

        gridInv.appendChild(slot);
    }
}

// Seleciona os sete espaços de equipamento do HTML, sem incluir a foto nem a mochila.
const slotsEquipamento = Array.from(
    document.querySelectorAll(".slot-vazio")
).filter((slot) => !slot.closest("#inventario") && !slot.classList.contains("foto-personagem"));

slotsEquipamento.forEach((slot) => {
    slot.dataset.original = slot.innerHTML.split("<span")[0];

    // Remove o onclick="upload(this)" antigo do HTML e usa o modal de itens.
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
const listaTalentos = $("talentos");

if (listaTalentos && !listaTalentos.children.length) {
    for (let i = 1; i <= 20; i++) {
        const linha = document.createElement("div");
        linha.className = "flex items-center gap-2 border-b border-black/20 pb-1";
        linha.innerHTML = `
            <span class="font-bold w-5 text-right text-[#111] text-sm">${i}.</span>
            <input type="text" class="bg-transparent border-none outline-none font-semibold text-[#111] text-base w-full">
        `;
        listaTalentos.appendChild(linha);
    }
}

// ======================================================
// SALVAMENTO COM DIAGNÓSTICO
// ======================================================
function dadosSegurosDoItem(slot) {
    const dados = JSON.parse(slot.dataset.itemData || "{}");

    return {
        img: typeof dados.img === "string" ? dados.img : "",
        nome: String(dados.nome ?? ""),
        qtd: Number(dados.qtd) || 1,
        peso: String(dados.peso ?? "0"),
        desc: String(dados.desc ?? "")
    };
}

function tamanhoEmBytes(valor) {
    return new TextEncoder().encode(JSON.stringify(valor)).length;
}

const btnSalvarFicha = $("btn-salvar-ficha");

btnSalvarFicha?.addEventListener("click", async () => {
    if (!usuarioAtual) {
        alert("Você precisa estar conectado para salvar a ficha.");
        return;
    }

    const textoBotao = btnSalvarFicha.textContent;
    btnSalvarFicha.disabled = true;
    btnSalvarFicha.textContent = "SALVANDO...";

    try {
        const foto = $("foto-personagem");

        const dadosFicha = {
            nome: $("nome")?.value || "",
            idade: $("idade")?.value || "",
            nivel: $("nivel")?.value || "",
            exp: $("exp")?.value || "",
            forca: forca?.value || "",
            destreza: destreza?.value || "",
            forcaAcao: forcaAcao?.value || "",
            destrezaAcao: destrezaAcao?.value || "",
            constituicao: $("constituicao")?.value || "",
            inteligencia: $("inteligencia")?.value || "",
            percepcao: $("percepcao")?.value || "",
            vontade: $("vontade")?.value || "",
            carisma: $("carisma")?.value || "",
            esquiva: $("esquiva")?.value || "",
            movimentacao: $("movimentacao")?.value || "6",
            diario: $("diario")?.value || "",
            fotoPersonagem: foto?.innerHTML || "",
            itensMochila: [],
            itensEquipamento: [],
            atualizadoEm: new Date().toISOString()
        };

        // Mochila: somente os slots dentro de #inventario.
        document.querySelectorAll("#inventario .item-adicionado").forEach((slot) => {
            dadosFicha.itensMochila.push({
                dados: dadosSegurosDoItem(slot),
                posicao: slot.id
            });
        });

        // Equipamentos: somente os sete slots definidos fora da mochila.
        slotsEquipamento.forEach((slot) => {
            if (slot.classList.contains("item-adicionado")) {
                dadosFicha.itensEquipamento.push({
                    dados: dadosSegurosDoItem(slot),
                    posicao: slot.dataset.original || slot.id
                });
            }
        });

        // Inclui os 20 talentos no salvamento, sem alterar o layout.
        dadosFicha.talentos = Array.from(listaTalentos?.querySelectorAll("input") || [])
            .map((input) => input.value || "");

        const bytes = tamanhoEmBytes(dadosFicha);

        console.info("Diagnóstico antes de salvar a ficha:", {
            usuario: usuarioAtual.uid,
            itensNaMochila: dadosFicha.itensMochila.length,
            itensEquipados: dadosFicha.itensEquipamento.length,
            tamanhoAproximadoKB: (bytes / 1024).toFixed(2)
        });

        // Margem de segurança abaixo do limite de 1 MiB por documento.
        if (bytes > 950 * 1024) {
            throw new Error("A ficha está muito grande para um único documento do Firestore. As imagens estão ocupando muito espaço. Reduza o tamanho das imagens e tente novamente.");
        }

        await setDoc(doc(db, "fichas", usuarioAtual.uid), dadosFicha);

        alert("Ficha salva com sucesso!");
    } catch (error) {
        console.error("Erro detalhado ao salvar ficha:", error);
        alert(`Não foi possível salvar a ficha (${error.code || "diagnóstico"}): ${error.message}`);
    } finally {
        btnSalvarFicha.disabled = false;
        btnSalvarFicha.textContent = textoBotao;
    }
});

// ======================================================
// CARREGAMENTO DA FICHA
// ======================================================
async function carregarFicha() {
    if (!usuarioAtual) return;

    const referencia = doc(db, "fichas", usuarioAtual.uid);
    const snapshot = await getDoc(referencia);
    if (!snapshot.exists()) return;

    const dados = snapshot.data();

    const preencher = (id, valor) => {
        const elemento = $(id);
        if (elemento) elemento.value = valor ?? "";
    };

    preencher("nome", dados.nome);
    preencher("idade", dados.idade);
    preencher("nivel", dados.nivel);
    preencher("exp", dados.exp);

    if (forca) forca.value = dados.forca ?? "";
    if (destreza) destreza.value = dados.destreza ?? "";
    calcular();

    preencher("constituicao", dados.constituicao);
    preencher("inteligencia", dados.inteligencia);
    preencher("percepcao", dados.percepcao);
    preencher("vontade", dados.vontade);
    preencher("carisma", dados.carisma);
    preencher("esquiva", dados.esquiva);
    preencher("movimentacao", dados.movimentacao ?? "6");
    preencher("diario", dados.diario);

    const foto = $("foto-personagem");
    if (foto && typeof dados.fotoPersonagem === "string" && dados.fotoPersonagem.includes("<img")) {
        foto.innerHTML = dados.fotoPersonagem;

        // Restaura a possibilidade de remover ou trocar a foto.
        const imagem = foto.querySelector("img");
        if (imagem) {
            foto.onclick = null;
        }
    }

    // Restaura os talentos salvos, quando existirem.
    const inputsTalentos = listaTalentos?.querySelectorAll("input") || [];
    if (Array.isArray(dados.talentos)) {
        inputsTalentos.forEach((input, indice) => {
            input.value = dados.talentos[indice] || "";
        });
    }

    // Limpa os 16 espaços antes de carregar os itens gravados.
    document.querySelectorAll("#inventario .item-adicionado").forEach(limparItemDoSlot);
    document.querySelectorAll("#inventario .slot-vazio").forEach((slot) => {
        slot.innerHTML = '<span class="text-2xl text-black/20 group-hover:text-red-800 transition-colors">+</span>';
    });

    // Limpa os equipamentos.
    slotsEquipamento.forEach((slot) => {
        limparItemDoSlot(slot);
    });

    if (Array.isArray(dados.itensMochila)) {
        dados.itensMochila.forEach((item) => {
            const slot = $(item.posicao);
            if (slot && slot.closest("#inventario") && item.dados) {
                renderizarItem(slot, item.dados);
            }
        });
    }

    if (Array.isArray(dados.itensEquipamento)) {
        dados.itensEquipamento.forEach((item) => {
            const slot = slotsEquipamento.find(
                (elemento) => (elemento.dataset.original || elemento.id) === item.posicao
            );
            if (slot && item.dados) renderizarItem(slot, item.dados);
        });
    }

    recalcularPesoTotal();
}

// ======================================================
// PAINEL DO MESTRE - LISTAGEM EXISTENTE
// ======================================================
const painelMestre = $("painel-mestre");
const listaJogadores = $("lista-jogadores");

$("btn-painel-mestre")?.addEventListener("click", async () => {
    const ehMestre = usuarioAtual &&
        (usuarioAtual.email || "").trim().toLowerCase() === emailMestre.toLowerCase();

    if (!ehMestre) {
        alert("Acesso não autorizado.");
        return;
    }

    painelMestre?.classList.remove("hidden");
    if (listaJogadores) listaJogadores.innerHTML = '<p>Buscando fichas...</p>';

    try {
        const resultado = await getDocs(collection(db, "fichas"));

        if (!listaJogadores) return;
        listaJogadores.innerHTML = "";

        if (resultado.empty) {
            listaJogadores.innerHTML = '<p class="text-center mt-10">Nenhum sobrevivente cadastrado ainda.</p>';
            return;
        }

        resultado.forEach((documento) => {
            const ficha = documento.data();
            const linha = document.createElement("div");
            linha.className = "border-b border-black/20 p-2 mb-2 flex justify-between items-center bg-white/20 rounded";

            const resumo = document.createElement("div");
            resumo.innerHTML = `
                <strong>Nome:</strong> ${String(ficha.nome || "Sem nome").replace(/[&<>"']/g, "")}
                | <strong>Nível:</strong> ${ficha.nivel || 1}
                | <strong>Força:</strong> ${ficha.forca || "-"} (${ficha.forcaAcao || 0}%)
            `;

            linha.appendChild(resumo);
            listaJogadores.appendChild(linha);
        });
    } catch (error) {
        console.error("Falha ao listar fichas:", error);
        if (listaJogadores) {
            listaJogadores.textContent = `Erro ao carregar as fichas (${error.code || "desconhecido"}): ${error.message}`;
        }
    }
});

$("btn-fechar-mestre")?.addEventListener("click", () => {
    painelMestre?.classList.add("hidden");
});
