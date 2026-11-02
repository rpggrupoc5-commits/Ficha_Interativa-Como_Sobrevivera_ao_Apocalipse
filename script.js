
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

// --- CONFIGURAÇÃO DO FIREBASE ---
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
let fichaAtualId = null;
let fichaAtualTipo = "jogador";
let fichaAtualProprietarioUid = null;
let fichaAtualCriadoPor = null;
const emailMestre = "rpggrupoc5@gmail.com";

// --- ATRIBUTOS (AÇÃO%) ---
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

// --- LOGIN ---
const telaLogin = document.getElementById('tela-login');
const sitePrincipal = document.getElementById('site-principal');
const mensagemErro = document.getElementById('mensagem-erro');

document.getElementById('btn-entrar').onclick = () => {
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;

    signInWithEmailAndPassword(auth, email, senha).catch((error) => {
        console.error("Falha no login Firebase:", error);
        mensagemErro.innerText = `Erro no login (${error.code || "desconhecido"}): ${error.message}`;
        mensagemErro.classList.remove('hidden');
    });
};

document.getElementById('btn-cadastrar').onclick = () => {
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;

    createUserWithEmailAndPassword(auth, email, senha).then(() => {
        alert("Conta criada! Bem-vindo.");
    }).catch((error) => {
        console.error("Falha no cadastro Firebase:", error);
        mensagemErro.innerText = `Erro no cadastro (${error.code || "desconhecido"}): ${error.message}`;
        mensagemErro.classList.remove('hidden');
    });
};

document.getElementById('btn-sair').onclick = () =>
    signOut(auth).then(() => window.location.reload());

onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioAtual = user;
        telaLogin.classList.add('hidden');
        sitePrincipal.classList.remove('hidden');
        const ehMestre = (user.email || '').trim().toLowerCase() === emailMestre.toLowerCase();
        const parametros = new URLSearchParams(window.location.search);
        const fichaSolicitada = parametros.get('ficha');

        if (fichaSolicitada) {
            mostrarAreaFicha();
            fichaAtualId = fichaSolicitada;
            carregarFicha().catch((error) => {
                console.error('Falha ao carregar ficha:', error);
                alert(`Erro ao carregar ficha (${error.code || 'desconhecido'}): ${error.message}`);
            });
        } else if (ehMestre) {
            document.getElementById('dashboard-mestre').classList.remove('hidden');
            document.getElementById('dashboard-jogador').classList.add('hidden');
            document.getElementById('area-ficha').classList.add('hidden');
            carregarDashboardMestre();
        } else {
            document.getElementById('dashboard-jogador').classList.remove('hidden');
            document.getElementById('dashboard-mestre').classList.add('hidden');
            document.getElementById('area-ficha').classList.add('hidden');
            carregarDashboardJogador();
        }
    } else {
        usuarioAtual = null;
        telaLogin.classList.remove('hidden');
        sitePrincipal.classList.add('hidden');
    }
});

function mostrarAreaFicha() {
    document.getElementById('dashboard-jogador').classList.add('hidden');
    document.getElementById('dashboard-mestre').classList.add('hidden');
    document.getElementById('area-ficha').classList.remove('hidden');
}

// ======================================================
// COMPRESSÃO DAS IMAGENS
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

            const canvas = document.createElement('canvas');
            canvas.width = largura;
            canvas.height = altura;

            const contexto = canvas.getContext('2d');
            contexto.drawImage(imagem, 0, 0, largura, altura);

            const comprimida = canvas.toDataURL('image/webp', 0.78);

            resolve(comprimida);
        };

        imagem.onerror = () => reject(new Error("Não foi possível processar esta imagem."));
        imagem.src = dataUrl;
    });
}

// --- SELEÇÃO DE IMAGENS ---
window.abrirSeletor = function(callback) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert("Selecione um arquivo de imagem.");
            return;
        }

        try {
            const reader = new FileReader();

            reader.onload = async (event) => {
                try {
                    const imagemComprimida = await comprimirImagem(event.target.result);
                    callback(imagemComprimida);
                } catch (erro) {
                    console.error(erro);
                    alert("Não foi possível preparar a imagem.");
                }
            };

            reader.readAsDataURL(file);
        } catch (erro) {
            console.error(erro);
            alert("Erro ao abrir a imagem.");
        }
    };

    input.click();
};

window.uploadFoto = function(elemento) {
    window.abrirSeletor((imgBase64) => {
        elemento.innerHTML = `
            <img src="${imgBase64}" style="width:100%;height:100%;object-fit:cover;object-position:top center;position:absolute;top:0;left:0;z-index:1;pointer-events:none;">
        `;

        elemento.onclick = null;

        const btn = document.createElement('div');
        btn.innerHTML = 'X';
        btn.className = 'absolute top-2 right-2 bg-red-800 text-white rounded-full w-6 h-6 flex items-center justify-center cursor-pointer z-20 text-sm font-bold shadow-lg opacity-0 transition-opacity duration-300 pointer-events-none';

        btn.onclick = (e) => {
            e.stopPropagation();

            elemento.innerHTML = '<i class="fa-solid fa-camera text-4xl text-black/20 mb-2"></i><span>FOTO DO<br>PERSONAGEM</span><div class="texto-proporcao">PROPORÇÃO IDEAL: 9x16</div>';
            elemento.onclick = () => window.uploadFoto(elemento);
        };

        elemento.appendChild(btn);

        let timer;

        elemento.onmouseenter = () => {
            clearTimeout(timer);
            btn.classList.remove('opacity-0');
            btn.classList.add('opacity-100');
        };

        elemento.onmouseleave = () => {
            timer = setTimeout(() => {
                btn.classList.add('opacity-0');
                btn.classList.remove('opacity-100');
            }, 1500);
        };
    });
};

// ======================================================
// INVENTÁRIO E EQUIPAMENTOS
// ======================================================

const gridInv = document.getElementById('inventario');
const espacosEl = document.getElementById('espacos');
const pesoEl = document.getElementById('peso-total');

let quadradoAtual = null;
let imagemAtualBase64 = null;

function recalcularPesoTotal() {
    let pesoTotal = 0;

    document.querySelectorAll('.item-adicionado').forEach(item => {
        const qtd = parseFloat(item.dataset.qtd) || 1;
        const pesoStr = (item.dataset.peso || "0").toString().replace(',', '.');
        pesoTotal += qtd * (parseFloat(pesoStr) || 0);
    });

    if (pesoEl) pesoEl.innerText = pesoTotal.toFixed(2);
    if (espacosEl) {
        espacosEl.innerText = document.querySelectorAll('#inventario .item-adicionado').length;
    }
}

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
                    <label class="flex flex-col text-sm font-bold text-[#111]">
                        Nome do Item:
                        <input type="text" id="modal-nome" class="input-campo p-2">
                    </label>

                    <button id="btn-upload" class="bg-[#3a2e27] text-white p-2 rounded font-bold hover:bg-[#a81c1c] transition text-sm">
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
                    <input type="text" id="modal-peso" class="input-campo p-2" placeholder="Ex: 0.5">
                </label>
            </div>

            <label class="flex flex-col text-sm font-bold text-[#111]">
                Descrição:
                <textarea id="modal-desc" class="input-campo p-2 resize-none h-16"></textarea>
            </label>

            <div class="flex justify-between mt-2 gap-2">
                <button id="btn-excluir" class="bg-gray-600 text-white p-2 rounded font-bold flex-1 hover:bg-gray-700 hidden">Excluir</button>
                <button id="btn-cancelar" class="bg-gray-600 text-white p-2 rounded font-bold flex-1 hover:bg-gray-700">Cancelar</button>
                <button id="btn-salvar-item" class="bg-[#a81c1c] text-white p-2 rounded font-bold flex-1 hover:brightness-125">Salvar</button>
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

function atualizarPreviewModal() {
    if (imagemAtualBase64) {
        modalPreview.innerHTML = `
            <img src="${imagemAtualBase64}" style="width:100%;height:100%;object-fit:contain;padding:4px;">
            <button id="btn-remover-img-modal" class="absolute top-1 right-1 bg-red-800 text-white rounded-full w-5 h-5 flex items-center justify-center cursor-pointer z-20 text-[10px] font-bold">X</button>
        `;

        modalPreview.classList.remove('border-dashed');
        modalPreview.classList.add('border-solid');

        document.getElementById('btn-remover-img-modal').onclick = (e) => {
            e.preventDefault();
            imagemAtualBase64 = null;
            atualizarPreviewModal();
        };
    } else {
        modalPreview.innerHTML = `
            <i class="fa-solid fa-camera text-2xl mb-1"></i>
            <span class="text-[9px] font-bold text-center leading-tight">SEM IMAGEM</span>
        `;

        modalPreview.classList.add('border-dashed');
        modalPreview.classList.remove('border-solid');
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
        btnExcluir.classList.remove('hidden');

        document.querySelector('#modal-item h3').innerText = "EDITAR ITEM";
        btnSalvarItem.innerText = "SALVAR";
    } else {
        inputNome.value = "";
        inputQtd.value = 1;
        inputPeso.value = "";
        inputDesc.value = "";

        imagemAtualBase64 = null;
        btnExcluir.classList.add('hidden');

        document.querySelector('#modal-item h3').innerText = "NOVO ITEM";
        btnSalvarItem.innerText = "ADICIONAR";
    }

    atualizarPreviewModal();
    modal.classList.remove('hidden');
}

btnCancelar.onclick = () => modal.classList.add('hidden');

btnUpload.onclick = () => {
    window.abrirSeletor((img) => {
        imagemAtualBase64 = img;
        atualizarPreviewModal();
    });
};

btnExcluir.onclick = () => {
    if (quadradoAtual.id.startsWith('inv-')) {
        quadradoAtual.innerHTML = '<span class="text-2xl text-black/20 group-hover:text-red-800 transition-colors">+</span>';
    } else {
        quadradoAtual.innerHTML = quadradoAtual.getAttribute('data-original') + '<span class="text-lg text-black/30"><i class="fa-solid fa-upload"></i></span>';
    }

    quadradoAtual.classList.remove('item-adicionado');
    quadradoAtual.removeAttribute('data-itemData');
    quadradoAtual.removeAttribute('data-peso');
    quadradoAtual.removeAttribute('data-qtd');

    recalcularPesoTotal();
    modal.classList.add('hidden');
};

btnSalvarItem.onclick = () => {
    const nome = inputNome.value;
    const pesoString = inputPeso.value.replace(',', '.');
    const qtd = parseInt(inputQtd.value) || 0;

    if (!imagemAtualBase64) return alert("Escolha uma imagem.");
    if (!nome.trim()) return alert("Digite o nome.");
    if (qtd <= 0) return alert("Quantidade > 0.");
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
    modal.classList.add('hidden');
};

function renderizarItem(q, dados) {
    const isEquipamento = !q.id.startsWith('inv-');
    const classeTexto = isEquipamento
        ? 'opacity-0 group-hover:opacity-100 transition-opacity'
        : 'opacity-100';

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
            if (q.classList.contains('item-adicionado')) {
                abrirModal(q, JSON.parse(q.dataset.itemData));
            } else {
                abrirModal(q);
            }
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
            if (slot.classList.contains('item-adicionado')) {
                abrirModal(slot, JSON.parse(slot.dataset.itemData));
            } else {
                abrirModal(slot);
            }
        };
    }
});

// --- TALENTOS ---
const listaT = document.getElementById('talentos');

if (listaT) {
    for (let i = 1; i <= 20; i++) {
        const l = document.createElement('div');

        l.className = 'flex items-center gap-2 border-b border-black/20 pb-1';
        l.innerHTML = `
            <span class="font-bold w-5 text-right text-[#111] text-sm">${i}.</span>
            <input type="text" class="bg-transparent border-none outline-none font-semibold text-[#111] text-base w-full">
        `;

        listaT.appendChild(l);
    }
}

// ======================================================
// IMAGENS SEPARADAS EM DOCUMENTOS DO FIRESTORE
// ======================================================

function imagemEhBase64(valor) {
    return typeof valor === 'string' && valor.startsWith('data:image/');
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

document.getElementById('btn-salvar-ficha').onclick = async () => {
    if (!usuarioAtual) return;

    const botaoSalvar = document.getElementById('btn-salvar-ficha');
    const textoOriginal = botaoSalvar.innerText;

    botaoSalvar.disabled = true;
    botaoSalvar.innerText = "SALVANDO...";

    try {
        const ehMestreSalvando = (usuarioAtual.email || '').trim().toLowerCase() === emailMestre.toLowerCase();
        const dadosFicha = {
            nome: document.getElementById('nome').value,
            idade: document.getElementById('idade').value,
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

            fotoPersonagem: "",
            itensMochila: [],
            itensEquipamento: []
        };

        const imagensAtivas = {};

        // FOTO DO PERSONAGEM
        const fotoContainer = document.getElementById('foto-personagem');
        const imagemRetrato = fotoContainer.querySelector('img');

        if (imagemRetrato) {
            const foto = imagemRetrato.getAttribute('src');

            if (imagemEhBase64(foto)) {
                imagensAtivas.personagem = foto;
            } else {
                imagensAtivas.personagem = foto;
            }

            dadosFicha.fotoPersonagem = fotoContainer.innerHTML.replace(
                foto,
                "__IMAGEM_PERSONAGEM__"
            );
        } else {
            dadosFicha.fotoPersonagem = fotoContainer.innerHTML;
        }

        // ITENS DA MOCHILA
        const itensMochila = document.querySelectorAll('#inventario .item-adicionado');

        for (const el of itensMochila) {
            const dados = JSON.parse(el.dataset.itemData);
            const imagemId = `mochila_${el.id}`;

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
                posicao: el.id
            });
        }

        // ITENS DOS EQUIPAMENTOS
        const todosSlots = Array.from(document.querySelectorAll('.slot-vazio'));
        const itensEquipamento = document.querySelectorAll('.slot-vazio.item-adicionado');

        for (const el of itensEquipamento) {
            const dados = JSON.parse(el.dataset.itemData);
            const indice = todosSlots.indexOf(el);
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
                posicao: el.getAttribute('data-original')
            });
        }

        // Garante que o documento principal exista antes de gravar imagens na subcoleção.
        // Isso é necessário na primeira gravação de uma ficha nova.
        if (ehMestreSalvando) {
            dadosFicha.tipo = fichaAtualTipo;
            dadosFicha.proprietarioUid = fichaAtualProprietarioUid;
            dadosFicha.criadoPor = fichaAtualCriadoPor || usuarioAtual.uid;
        }
        await setDoc(doc(db, "fichas", fichaAtualId), dadosFicha, { merge: true });

        // SALVA CADA IMAGEM EM SEU PRÓPRIO DOCUMENTO
        for (const [idImagem, imagem] of Object.entries(imagensAtivas)) {
            await salvarImagemSeparada(idImagem, imagem);
        }

        // REMOVE IMAGENS ANTIGAS QUE NÃO ESTÃO MAIS SENDO USADAS
        const imagensAntigas = await getDocs(
            collection(db, "fichas", fichaAtualId, "imagens")
        );

        for (const documento of imagensAntigas.docs) {
            if (!imagensAtivas[documento.id]) {
                await deleteDoc(documento.ref);
            }
        }

        // SALVA OS DADOS PRINCIPAIS DA FICHA
        // O jogador atualiza somente os campos permitidos pelas regras.
        // O merge preserva proprietarioUid, tipo e criadoPor. O mestre mantém metadados administrativos.
        alert("Ficha salva com sucesso!");

    } catch (e) {
        console.error("Falha ao salvar ficha:", e);

        alert(
            `Erro ao salvar ficha (${e.code || "desconhecido"}): ${e.message}`
        );

    } finally {
        botaoSalvar.disabled = false;
        botaoSalvar.innerText = textoOriginal;
    }
};

// ======================================================
// CARREGAR FICHA
// ======================================================

async function carregarFicha() {
    if (!usuarioAtual || !fichaAtualId) return;

    let docSnap = await getDoc(doc(db, "fichas", fichaAtualId));
    const ehMestre = (usuarioAtual.email || '').trim().toLowerCase() === emailMestre.toLowerCase();

    if (!docSnap.exists() && fichaAtualId === usuarioAtual.uid) {
        const vinculadas = await getDocs(query(
            collection(db, 'fichas'),
            where('proprietarioUid', '==', usuarioAtual.uid),
            limit(1)
        ));
        if (!vinculadas.empty) {
            docSnap = vinculadas.docs[0];
            fichaAtualId = docSnap.id;
        }
    }

    if (!docSnap.exists()) {
        if (fichaAtualId !== usuarioAtual.uid) {
            alert("Esta ficha não foi encontrada ou você não tem acesso a ela.");
            window.location.href = window.location.pathname;
        }
        return;
    }

    const d = docSnap.data();
    if (!ehMestre && fichaAtualId !== usuarioAtual.uid && d.proprietarioUid !== usuarioAtual.uid) {
        alert('Você não tem permissão para abrir esta ficha.');
        window.location.href = window.location.pathname;
        return;
    }
    fichaAtualTipo = d.tipo || (fichaAtualId === usuarioAtual.uid ? "jogador" : "jogador");
    fichaAtualProprietarioUid = d.proprietarioUid || (fichaAtualTipo === "jogador" ? fichaAtualId : null);
    fichaAtualCriadoPor = d.criadoPor || fichaAtualProprietarioUid || usuarioAtual.uid;

    // BUSCA AS IMAGENS SEPARADAS
    const imagensSeparadas = await carregarImagensSeparadas();

    document.getElementById('nome').value = d.nome || '';
    document.getElementById('idade').value = d.idade || '';
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

    const camposTalentos = document.querySelectorAll('#talentos input');
    camposTalentos.forEach((input, indice) => { input.value = (d.talentos || [])[indice] || ''; });

    // FOTO DO PERSONAGEM
    if (d.fotoPersonagem && d.fotoPersonagem.includes('img')) {
        let fotoHTML = d.fotoPersonagem;

        if (imagensSeparadas.personagem) {
            fotoHTML = fotoHTML.replace(
                "__IMAGEM_PERSONAGEM__",
                imagensSeparadas.personagem
            );
        }

        document.getElementById('foto-personagem').innerHTML = fotoHTML;
    }

    // LIMPA OS ITENS VISUAIS ANTES DE RECARREGAR
    document.querySelectorAll('.item-adicionado').forEach(el => {
        el.classList.remove('item-adicionado');
        el.removeAttribute('data-itemData');
        el.removeAttribute('data-peso');
        el.removeAttribute('data-qtd');
    });

    // CARREGA ITENS DA MOCHILA
    if (d.itensMochila) {
        d.itensMochila.forEach(item => {
            const el = document.getElementById(item.posicao);

            if (el) {
                const dados = { ...item.dados };

                if (item.imagemId && imagensSeparadas[item.imagemId]) {
                    dados.img = imagensSeparadas[item.imagemId];
                }

                // Compatibilidade com fichas antigas
                if (!dados.img && item.dados.img) {
                    dados.img = item.dados.img;
                }

                renderizarItem(el, dados);
            }
        });
    }

    // CARREGA EQUIPAMENTOS
    if (d.itensEquipamento) {
        d.itensEquipamento.forEach(item => {
            const el = Array.from(document.querySelectorAll('.slot-vazio'))
                .find(e => e.getAttribute('data-original') === item.posicao);

            if (el) {
                const dados = { ...item.dados };

                if (item.imagemId && imagensSeparadas[item.imagemId]) {
                    dados.img = imagensSeparadas[item.imagemId];
                }

                // Compatibilidade com fichas antigas
                if (!dados.img && item.dados.img) {
                    dados.img = item.dados.img;
                }

                renderizarItem(el, dados);
            }
        });
    }

    recalcularPesoTotal();
}

// ======================================================
// PAINÉIS DE PERSONAGENS E DO MESTRE
// ======================================================

function abrirFichaEmNovaAba(idFicha) {
    const url = new URL(window.location.href);
    url.searchParams.set('ficha', idFicha);
    window.open(url.toString(), '_blank', 'noopener');
}

function criarBotaoPainel(texto, classe, acao) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.textContent = texto;
    botao.className = `px-3 py-2 rounded text-xs font-bold text-white ${classe}`;
    botao.addEventListener('click', acao);
    return botao;
}

async function obterImagemRetrato(idFicha, ficha) {
    try {
        const imagem = await getDoc(doc(db, 'fichas', idFicha, 'imagens', 'personagem'));
        if (imagem.exists() && imagem.data().imagem) return imagem.data().imagem;
    } catch (e) { console.warn('Não foi possível carregar o retrato do card:', idFicha, e); }
    const html = ficha.fotoPersonagem || '';
    const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    return match ? match[1] : '';
}

function criarCardFicha(idFicha, ficha, modoMestre = false) {
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
    const nome = document.createElement('h3'); nome.className = 'fonte-titulo text-2xl'; nome.textContent = ficha.nome || 'Personagem sem nome';
    const tipo = ficha.tipo === 'pdm' ? 'PDM' : 'PERSONAGEM';
    const detalhes = document.createElement('p'); detalhes.className = 'text-sm text-[#d2b48c]';
    detalhes.textContent = `${tipo} • Nível ${ficha.nivel || '1'} • EXP ${ficha.exp || '0'}`;
    conteudo.append(nome, detalhes);
    if (modoMestre) {
        const dono = document.createElement('p'); dono.className = 'text-xs text-white/60 break-all';
        dono.textContent = ficha.proprietarioNome || ficha.proprietarioEmail || (ficha.proprietarioUid ? `UID: ${ficha.proprietarioUid}` : (ficha.tipo === 'pdm' ? 'Sem jogador vinculado' : `Ficha antiga • ${idFicha.slice(0, 8)}`));
        conteudo.append(dono);
    }
    const acoes = document.createElement('div'); acoes.className = 'mt-auto pt-3 flex flex-wrap gap-2';
    acoes.append(criarBotaoPainel(modoMestre ? 'ABRIR / EDITAR' : 'ABRIR FICHA', 'bg-[#a81c1c] hover:brightness-125', () => abrirFichaEmNovaAba(idFicha)));
    if (modoMestre) {
        acoes.append(criarBotaoPainel('DUPLICAR', 'bg-blue-800', () => duplicarFicha(idFicha, ficha)));
        acoes.append(criarBotaoPainel('VINCULAR', 'bg-green-800', () => vincularJogador(idFicha, ficha)));
        if (ficha.proprietarioUid) acoes.append(criarBotaoPainel('DESVINCULAR', 'bg-gray-700', () => desvincularJogador(idFicha, ficha)));
        acoes.append(criarBotaoPainel('EXCLUIR', 'bg-red-900', () => excluirFicha(idFicha, ficha)));
    }
    conteudo.append(acoes); card.append(retrato, conteudo); return card;
}

async function carregarDashboardJogador() {
    const lista = document.getElementById('cards-jogador');
    lista.innerHTML = '<p class="text-[#111]">Carregando seus personagens...</p>';
    try {
        const encontrados = new Map();
        // Ficha legada cujo ID é o UID: leitura direta, sem alterar o documento.
        const propria = await getDoc(doc(db, 'fichas', usuarioAtual.uid));
        if (propria.exists()) encontrados.set(propria.id, propria.data());
        // Fichas adicionais vinculadas ao mesmo jogador.
        const vinculadas = await getDocs(query(collection(db, 'fichas'), where('proprietarioUid', '==', usuarioAtual.uid)));
        vinculadas.forEach(d => encontrados.set(d.id, d.data()));
        lista.innerHTML = '';
        if (!encontrados.size) { lista.innerHTML = '<p class="text-[#111] col-span-full text-center py-10">Nenhum personagem encontrado nesta conta.</p>'; return; }
        [...encontrados.entries()].sort((a,b) => (a[1].nome || '').localeCompare(b[1].nome || '', 'pt-BR')).forEach(([id, ficha]) => lista.appendChild(criarCardFicha(id, ficha)));
    } catch (e) {
        console.error('Erro ao carregar painel do jogador:', e);
        lista.innerHTML = `<p class="text-red-800 col-span-full">Não foi possível listar seus personagens (${e.code || 'erro'}): ${e.message}</p>`;
    }
}

async function carregarDashboardMestre() {
    const lista = document.getElementById('cards-mestre');
    lista.innerHTML = '<p class="text-[#111]">Carregando todas as fichas...</p>';
    try {
        const snapshot = await getDocs(collection(db, 'fichas'));
        lista.innerHTML = '';
        const docs = [...snapshot.docs].sort((a,b) => (a.data().nome || '').localeCompare(b.data().nome || '', 'pt-BR'));
        const pdms = docs.filter(d => d.data().tipo === 'pdm').length;
        document.getElementById('contador-fichas').textContent = `Fichas: ${docs.length}`;
        document.getElementById('contador-pdms').textContent = `PDMs: ${pdms}`;
        if (!docs.length) { lista.innerHTML = '<p class="text-[#111] col-span-full text-center py-10">Nenhuma ficha cadastrada.</p>'; return; }
        docs.forEach(d => lista.appendChild(criarCardFicha(d.id, d.data(), true)));
    } catch (e) {
        console.error('Erro ao carregar painel do mestre:', e);
        lista.innerHTML = `<p class="text-red-800 col-span-full">Erro ao carregar fichas (${e.code || 'erro'}): ${e.message}</p>`;
    }
}

async function atualizarPainelMestre() { return carregarDashboardMestre(); }

function voltarAoPainel() {
    const url = new URL(window.location.href); url.searchParams.delete('ficha'); window.location.href = url.toString();
}

document.getElementById('btn-voltar-painel').onclick = voltarAoPainel;
document.getElementById('btn-sair-jogador').onclick = () => signOut(auth).then(() => window.location.reload());
document.getElementById('btn-sair-mestre').onclick = () => signOut(auth).then(() => window.location.reload());
document.getElementById('btn-criar-pdm-dashboard').onclick = criarPDM;

// ======================================================
// ADMINISTRAÇÃO DE FICHAS PELO MESTRE
// ======================================================

async function criarPDM() {
    if (!usuarioAtual || (usuarioAtual.email || '').trim().toLowerCase() !== emailMestre.toLowerCase()) return;
    const nome = prompt('Nome do novo PDM:', 'Novo PDM');
    if (nome === null) return;
    try {
        const novaFicha = doc(collection(db, 'fichas'));
        await setDoc(novaFicha, { tipo: 'pdm', proprietarioUid: null, proprietarioNome: '', criadoPor: usuarioAtual.uid, nome: nome.trim() || 'Novo PDM', idade: '', nivel: '1', exp: '', forca: '', destreza: '', forcaAcao: '', destrezaAcao: '', constituicao: '', inteligencia: '', percepcao: '', vontade: '', carisma: '', esquiva: '', movimentacao: '6', diario: '', talentos: [], fotoPersonagem: '', itensMochila: [], itensEquipamento: [] });
        await atualizarPainelMestre(); alert('PDM criado!');
    } catch (e) { console.error(e); alert(`Não foi possível criar o PDM: ${e.message}`); }
}

async function excluirFicha(idFicha, ficha) {
    if (!confirm(`Tem certeza de que deseja excluir ${ficha.nome || 'esta ficha'}? Esta ação não pode ser desfeita.`)) return;
    try { const imagens = await getDocs(collection(db, 'fichas', idFicha, 'imagens')); const lote = writeBatch(db); imagens.forEach(item => lote.delete(item.ref)); lote.delete(doc(db, 'fichas', idFicha)); await lote.commit(); await atualizarPainelMestre(); alert('Ficha e imagens excluídas.'); }
    catch (e) { console.error(e); alert(`Erro ao excluir ficha: ${e.message}`); }
}

async function duplicarFicha(idFicha, ficha) {
    const novoNome = prompt('Nome da cópia:', `${ficha.nome || 'Personagem'} (Cópia)`); if (novoNome === null) return;
    try { const imagensOrigem = await getDocs(collection(db, 'fichas', idFicha, 'imagens')); const novaRef = doc(collection(db, 'fichas')); const copia = { ...ficha, nome: novoNome.trim() || `${ficha.nome || 'Personagem'} (Cópia)`, tipo: 'pdm', proprietarioUid: null, proprietarioNome: '', proprietarioEmail: '', criadoPor: usuarioAtual.uid }; await setDoc(novaRef, copia); const lote = writeBatch(db); imagensOrigem.forEach(item => lote.set(doc(db, 'fichas', novaRef.id, 'imagens', item.id), item.data())); if (!imagensOrigem.empty) await lote.commit(); await atualizarPainelMestre(); alert('Cópia criada como PDM independente.'); }
    catch (e) { console.error(e); alert(`Erro ao duplicar ficha: ${e.message}`); }
}

async function vincularJogador(idFicha, ficha) {
    const uid = prompt('UID da conta Firebase do jogador:', ficha.proprietarioUid || ''); if (uid === null) return; const uidLimpo = uid.trim();
    if (!uidLimpo || uidLimpo.length < 10) return alert('Informe o UID completo da conta Firebase.');
    const nomeJogador = prompt('Nome do jogador (opcional):', ficha.proprietarioNome || ''); if (nomeJogador === null) return;
    try { await setDoc(doc(db, 'fichas', idFicha), { proprietarioUid: uidLimpo, proprietarioNome: nomeJogador.trim(), tipo: 'jogador' }, { merge: true }); await atualizarPainelMestre(); alert('Jogador vinculado.'); }
    catch (e) { console.error(e); alert(`Erro ao vincular jogador: ${e.message}`); }
}

async function desvincularJogador(idFicha, ficha) {
    if (!ficha.proprietarioUid) return alert('Esta ficha não possui jogador vinculado.');
    if (!confirm(`Desvincular o jogador desta ficha (${ficha.nome || 'Sem nome'})?`)) return;
    try { await setDoc(doc(db, 'fichas', idFicha), { proprietarioUid: null, proprietarioNome: '', proprietarioEmail: '', tipo: 'pdm' }, { merge: true }); await atualizarPainelMestre(); alert('Jogador desvinculado. A ficha agora é um PDM.'); }
    catch (e) { console.error(e); alert(`Erro ao desvincular: ${e.message}`); }
}
