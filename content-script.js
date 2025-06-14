(function() {
    'use strict';

    // 이미 처리된 URL들을 저장할 Set
    const processedUrls = new Set();
    
    // 현재 URL 추적
    let currentUrl = window.location.href;

    // 실행해야 할 페이지인지 확인
    function shouldRunOnCurrentPage(url = window.location.href) {
        // 엔트리 이야기 페이지에서만 실행
        return url.includes('playentry.org/community/entrystory/') || 
               url.includes('playentry.org/community/') ||
               url.includes('playentry.org/project/'); // 프로젝트 페이지도 포함
    }

    // CSRF 토큰 가져오기
    function getCsrfToken() {
        const csrfMeta = document.querySelector('meta[name="csrf-token"]');
        return csrfMeta ? csrfMeta.getAttribute('content') : null;
    }

    // xToken 가져오기
    function getXToken() {
        const nextDataEl = document.getElementById('__NEXT_DATA__');
        if (!nextDataEl) {
            console.error('토큰 데이터를 포함한 __NEXT_DATA__ 태그를 찾을 수 없습니다.');
            return null;
        }

        let data;
        try {
            data = JSON.parse(nextDataEl.textContent);
        } catch (error) {
            console.error('JSON 파싱 중 오류가 발생했습니다:', error);
            return null;
        }

        function findXToken(obj) {
            if (obj && typeof obj === 'object') {
                if ('xToken' in obj) {
                    return obj.xToken;
                }
                for (const key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        const result = findXToken(obj[key]);
                        if (result) return result;
                    }
                }
            }
            return null;
        }

        const xToken = findXToken(data);
        if (xToken) {
            console.log('찾은 xToken:', xToken);
            return xToken;
        } else {
            console.error('JSON 데이터 내에서 xToken 값을 찾을 수 없습니다.');
            return null;
        }
    }

    // 좋아요 상태 확인
    async function checkLikeStatus(projectId) {
        const csrfToken = getCsrfToken();
        const xToken = getXToken();

        if (!csrfToken || !xToken) {
            console.error('토큰을 가져올 수 없습니다.');
            return false;
        }

        try {
            const response = await fetch("https://playentry.org/graphql/CHECK_LIKE", {
                "headers": {
                    "accept": "*/*",
                    "accept-language": "ja,en-US;q=0.9,en;q=0.8,ko;q=0.7",
                    "content-type": "application/json",
                    "csrf-token": csrfToken,
                    "priority": "u=1, i",
                    "sec-ch-ua": "\"Not)A;Brand\";v=\"8\", \"Chromium\";v=\"138\", \"Google Chrome\";v=\"138\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"Linux\"",
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin",
                    "x-client-type": "Client",
                    "x-token": xToken
                },
                "referrer": window.location.href,
                "referrerPolicy": "strict-origin-when-cross-origin",
                "body": JSON.stringify({
                    "query": "\n    query CHECK_LIKE($target: String!, $groupId: ID){\n        checkLike(target: $target, groupId: $groupId) {\n            isLike\n        }\n    }\n",
                    "variables": {
                        "target": projectId,
                        "targetSubject": "project",
                        "targetType": "individual"
                    }
                }),
                "method": "POST",
                "mode": "cors",
                "credentials": "include"
            });

            const data = await response.json();
            return data?.data?.checkLike?.isLike === true;
        } catch (error) {
            console.error('좋아요 상태 확인 중 오류:', error);
            return false;
        }
    }

    // 프로젝트 ID 추출
    function extractProjectId(url) {
        const match = url.match(/https:\/\/playentry\.org\/project\/([^\/\?]+)/);
        return match ? match[1] : null;
    }

    // 요소 제거 및 메시지 표시
    function removeElementAndShowMessage(element) {
        // 부모 요소를 찾아서 내용을 클리어
        let parentElement = element.closest('div, article, section, li');
        if (!parentElement) {
            parentElement = element.parentElement;
        }

        if (parentElement) {
            parentElement.innerHTML = '<div style="padding: 20px; text-align: center; color: #666; font-size: 14px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">좋아요를 누른 홍보가 감지되어 삭제되었습니다.</div>';
        }
    }

    // 페이지에서 프로젝트 링크 감지
    function detectProjectLinks() {
        // 현재 페이지가 실행 대상인지 확인
        if (!shouldRunOnCurrentPage()) {
            return;
        }
        
        const links = document.querySelectorAll('a[href*="playentry.org/project/"]');
        
        links.forEach(async (link) => {
            const href = link.href;
            const projectId = extractProjectId(href);
            
            if (!projectId) return;
            
            // 이미 처리된 URL인지 확인
            if (processedUrls.has(href)) return;

            try {
                const isLiked = await checkLikeStatus(projectId);
                
                if (isLiked) {
                    // 좋아요가 true인 경우 요소 제거
                    removeElementAndShowMessage(link);
                    console.log('좋아요 홍보 감지 및 제거:', href);
                }
                
                processedUrls.add(href);
            } catch (error) {
                console.error('링크 처리 중 오류:', error);
            }
        });
    }

    // URL 변경 감지 함수
    function checkUrlChange() {
        if (currentUrl !== window.location.href) {
            console.log('URL 변경 감지:', currentUrl, '->', window.location.href);
            const previousUrl = currentUrl;
            currentUrl = window.location.href;
            
            // URL이 변경되면 처리된 URL 목록 초기화 (새 페이지의 링크들을 다시 처리하기 위해)
            processedUrls.clear();
            
            // 새 페이지가 실행 대상인지 확인
            if (shouldRunOnCurrentPage()) {
                console.log('대상 페이지로 이동했습니다. 홍보 제거 기능을 시작합니다.');
                
                // 이전에 대상 페이지가 아니었다면 MutationObserver 새로 설정
                if (!shouldRunOnCurrentPage(previousUrl)) {
                    setupMutationObserver();
                }
                
                // 링크 감지 시작
                setTimeout(detectProjectLinks, 1000); // 1초 후 실행 (페이지 로딩 대기)
            } else {
                console.log('대상 페이지가 아닙니다. 대기 중...');
            }
        }
    }

    // History API 오버라이드하여 pushState/replaceState 감지
    function setupHistoryListener() {
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function() {
            console.log('pushState 감지됨:', arguments);
            originalPushState.apply(history, arguments);
            setTimeout(checkUrlChange, 100);
        };

        history.replaceState = function() {
            console.log('replaceState 감지됨:', arguments);
            originalReplaceState.apply(history, arguments);
            setTimeout(checkUrlChange, 100);
        };

        // popstate 이벤트 (뒤로가기/앞으로가기) 감지
        window.addEventListener('popstate', function() {
            console.log('popstate 이벤트 감지됨');
            setTimeout(checkUrlChange, 100);
        });
        
        console.log('History API 리스너가 설정되었습니다.');
    }

    // DOM 변경 감지 (추가적인 안전장치)
    function setupMutationObserver() {
        const observer = new MutationObserver(function(mutations) {
            let shouldCheck = false;
            
            mutations.forEach(function(mutation) {
                // 새로운 노드가 추가되었는지 확인
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    for (let node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // 프로젝트 링크가 포함된 새로운 요소가 추가되었는지 확인
                            if (node.querySelector && node.querySelector('a[href*="playentry.org/project/"]')) {
                                shouldCheck = true;
                                break;
                            }
                            // 노드 자체가 프로젝트 링크인지 확인
                            if (node.tagName === 'A' && node.href && node.href.includes('playentry.org/project/')) {
                                shouldCheck = true;
                                break;
                            }
                        }
                    }
                }
            });
            
            if (shouldCheck) {
                setTimeout(detectProjectLinks, 500);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 초기화
    function init() {
        // History API 리스너는 항상 설정 (URL 변경 감지를 위해)
        setupHistoryListener();
        
        // 주기적 URL 체크도 항상 실행 (fallback)
        setInterval(checkUrlChange, 1000);
        
        // 현재 페이지가 실행 대상인지 확인
        if (!shouldRunOnCurrentPage()) {
            console.log('Entry 좋아요 홍보 제거기: 대상 페이지가 아니므로 대기 중입니다. URL 변경을 감지합니다.');
            return;
        }
        
        // 대상 페이지에서만 실행되는 기능들
        setupMutationObserver();
        setInterval(detectProjectLinks, 2000);
        detectProjectLinks();
        
        console.log('Entry 좋아요 홍보 제거기가 시작되었습니다. (URL 변경 감지 기능 포함)');
    }

    // DOM이 준비되면 초기화
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(); 