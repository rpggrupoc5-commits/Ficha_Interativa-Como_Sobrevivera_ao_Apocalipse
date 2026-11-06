rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function logado() {
      return request.auth != null;
    }

    function mestre() {
      return logado()
        && request.auth.token.email == "rpggrupoc5@gmail.com";
    }

    function camposFicha() {
      return [
        'nome', 'idade', 'nivel', 'exp', 'forca', 'destreza',
        'forcaAcao', 'destrezaAcao', 'constituicao', 'inteligencia',
        'percepcao', 'vontade', 'carisma', 'esquiva', 'movimentacao',
        'diario', 'talentos', 'fotoPersonagem', 'itensMochila',
        'itensEquipamento', 'altura', 'sexo', 'etnia', 'corPele',
        'pesoPersonagem', 'fotoPersonagemNome', 'fotoPersonagemDesc'
      ];
    }

    function caminhoFicha(fichaId) {
      return /databases/$(database)/documents/fichas/$(fichaId);
    }

    function caminhoAcesso(fichaId) {
      return /databases/$(database)/documents/fichas/$(fichaId)/acessos/$(request.auth.uid);
    }

    function existeFicha(fichaId) {
      return exists(caminhoFicha(fichaId));
    }

    function donoFicha(fichaId) {
      return logado()
        && (fichaId == request.auth.uid
            || (existeFicha(fichaId)
                && get(caminhoFicha(fichaId)).data.proprietarioUid == request.auth.uid));
    }

    function temAcessoConvidado(fichaId) {
      return logado() && exists(caminhoAcesso(fichaId));
    }

    function convidadoPodeEditar(fichaId) {
      return temAcessoConvidado(fichaId)
        && get(caminhoAcesso(fichaId)).data.permissao == "editar";
    }

    function podeAcessarFicha(fichaId) {
      return mestre() || donoFicha(fichaId) || temAcessoConvidado(fichaId);
    }

    match /fichas/{fichaId} {

      allow get: if mestre()
        || (logado() && (fichaId == request.auth.uid
            || resource.data.proprietarioUid == request.auth.uid))
        || temAcessoConvidado(fichaId);

      allow list: if mestre()
        || (logado() && resource.data.proprietarioUid == request.auth.uid);

      allow create: if mestre()
        || (logado() && fichaId == request.auth.uid
            && request.resource.data.keys().hasOnly(camposFicha()));

      allow update: if mestre()
        || (donoFicha(fichaId)
            && request.resource.data.diff(resource.data)
                .affectedKeys().hasOnly(camposFicha()))
        || (convidadoPodeEditar(fichaId)
            && request.resource.data.diff(resource.data)
                .affectedKeys().hasOnly(camposFicha()));

      allow delete: if mestre();

      match /imagens/{imagemId} {
        allow read: if podeAcessarFicha(fichaId);
        allow write: if mestre()
          || donoFicha(fichaId)
          || convidadoPodeEditar(fichaId);
      }

      match /solicitacoes/{uidConvidado} {
        allow create: if logado()
          && request.auth.uid == uidConvidado
          && request.resource.data.uidConvidado == uidConvidado
          && request.resource.data.fichaId == fichaId
          && request.resource.data.status == "pendente";
        allow get: if logado() && request.auth.uid == uidConvidado;
        allow read, update, delete: if mestre();
      }

      match /acessos/{uidConvidado} {
        allow get: if logado() && request.auth.uid == uidConvidado;
        allow read, write, delete: if mestre();
      }
    }

    match /usuarios/{uid} {
      allow get: if mestre() || (logado() && request.auth.uid == uid);
      allow list: if mestre();
      allow create, update: if logado()
        && request.auth.uid == uid
        && request.resource.data.keys().hasOnly(['uid', 'email', 'nome', 'atualizadoEm'])
        && request.resource.data.uid == uid;
      allow delete: if mestre();
    }

    match /convites/{token} {
      allow read, write: if mestre();
    }
  }
}
